import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL profile policies isolate accounts and prevent role/approval escalation', async () => {
  const db = new PGlite();
  const passenger = '00000000-0000-4000-8000-000000000001';
  const driver = '00000000-0000-4000-8000-000000000002';
  const social = '00000000-0000-4000-8000-000000000003';
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key, raw_app_meta_data jsonb, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(await readFile('supabase/migrations/202611090001_accounts.sql', 'utf8'));
    for (const [id, provider, role] of [[passenger, 'email', 'pasajero'], [driver, 'email', 'conductor'], [social, 'google', 'admin']]) {
      await db.query('insert into auth.users values ($1, $2::jsonb, $3::jsonb)', [id, JSON.stringify({provider}), JSON.stringify({role, full_name: 'MotoGo Test'})]);
    }
    const asAccount = async (id: string) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec('set role authenticated');
    };
    await asAccount(passenger);
    const own = await db.query<{id: string; role: string}>('select id, role from public.profiles');
    assert.deepEqual(own.rows, [{id: passenger, role: 'pasajero'}]);
    await assert.rejects(db.query("update public.profiles set role='conductor' where id=$1", [passenger]));
    await assert.rejects(db.query("update public.profiles set driver_status='approved' where id=$1", [passenger]));
    await assert.rejects(db.query('insert into public.profiles(id) values ($1)', [social]));
    const untouched = await db.query('update public.profiles set full_name=$1 where id=$2 returning id', ['Other', driver]);
    assert.equal(untouched.rows.length, 0);
    await db.query('update public.profiles set full_name=$1 where id=$2', ['Own name', passenger]);

    await asAccount(driver);
    const pending = await db.query<{driver_status: string}>('select driver_status from public.profiles');
    assert.equal(pending.rows[0].driver_status, 'pending');
    await assert.rejects(db.exec("update public.profiles set driver_status='approved'"));
    await db.query('select public.complete_onboarding($1)', ['pasajero']);
    assert.equal((await db.query<{role: string}>('select role from public.profiles')).rows[0].role, 'conductor');

    await asAccount(social);
    assert.equal((await db.query<{role: string | null}>('select role from public.profiles')).rows[0].role, null);
    await assert.rejects(db.query('select public.complete_onboarding($1)', ['admin']));
    await db.query('select public.complete_onboarding($1)', ['conductor']);
    const completed = await db.query<{role: string; driver_status: string}>('select role, driver_status from public.profiles');
    assert.deepEqual(completed.rows, [{role: 'conductor', driver_status: 'pending'}]);

    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.profiles'));
    await assert.rejects(db.query('select public.complete_onboarding($1)', ['pasajero']));
  } finally {await db.close();}
});
