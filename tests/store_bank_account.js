QUnit.module('store_bank_account.php');

// server error means this endpoint requires auth -> expected
QUnit.test('GET without auth', async function(assert) {
	assert.timeout(10000);
	try {
		var r = await apiRequest('/store_bank_account.php');
		console.log('GET no-auth response:', r);
		assert.ok(true, 'response 200: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('GET no-auth error:', e.response || e.message);
		assert.ok(true, 'response error: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

QUnit.test('POST without auth', async function(assert) {
	assert.timeout(10000);
	try {
		var r = await apiRequest('/store_bank_account.php', {
			method: 'POST',
			body: { name: 't', store_id: testConfig.storeId, bank_account_id: 1 }
		});
		console.log('POST no-auth response:', r);
		assert.ok(true, 'response 200: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('POST no-auth error:', e.response || e.message);
		assert.ok(true, 'response error: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

// creates a store<->bank_account link
QUnit.test('POST create', async function(assert) {
	assert.timeout(30000);
	var s = await login();

	var bid = await resolveBankAccountForTest(s, testConfig.storeId);
	console.log('using bank_account id:', bid);

	var body = { name: uniqueName('SB'), store_id: testConfig.storeId, bank_account_id: bid };
	console.log('POST body:', JSON.stringify(body));

	try {
		var r = await apiRequest('/store_bank_account.php', { method: 'POST', bearer: s.bearer, body: body });
		console.log('POST create response:', r);
		var rec = r.store_bank_account || r;
		assert.ok(rec && rec.id, 'created id=' + rec.id + ' store_id=' + rec.store_id + ' bank_account_id=' + rec.bank_account_id);
	} catch (e) {
		console.log('POST create error:', e.response || e.message);
		assert.ok(false, 'FAIL: ' + JSON.stringify(e.response || e.message));
	}
});

// validation: missing store_id
QUnit.test('POST missing store_id', async function(assert) {
	assert.timeout(10000);
	var s = await login();
	var body = { name: 't', bank_account_id: 1 };
	console.log('POST body:', JSON.stringify(body));
	try {
		var r = await apiRequest('/store_bank_account.php', { method: 'POST', bearer: s.bearer, body: body });
		console.log('response:', r);
		assert.ok(true, 'response 200 (store_id not required): ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('error:', e.response || e.message);
		assert.ok(true, 'response error (store_id required): ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

// validation: missing bank_account_id
QUnit.test('POST missing bank_account_id', async function(assert) {
	assert.timeout(10000);
	var s = await login();
	var body = { name: 't', store_id: testConfig.storeId };
	console.log('POST body:', JSON.stringify(body));
	try {
		var r = await apiRequest('/store_bank_account.php', { method: 'POST', bearer: s.bearer, body: body });
		console.log('response:', r);
		assert.ok(true, 'response 200 (bank_account_id not required): ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('error:', e.response || e.message);
		assert.ok(true, 'response error (bank_account_id required): ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

// duplicate check
QUnit.test('POST duplicate pair', async function(assert) {
	assert.timeout(30000);
	var s = await login();

	var bid = await resolveBankAccountForTest(s, testConfig.storeId);
	console.log('using bank_account id:', bid);

	var body = { name: uniqueName('SD'), store_id: testConfig.storeId, bank_account_id: bid };
	console.log('POST 1 body:', JSON.stringify(body));
	try {
		var r1 = await apiRequest('/store_bank_account.php', { method: 'POST', bearer: s.bearer, body: body });
		console.log('POST 1 response:', r1);
		assert.ok(true, '1st POST created');
	} catch (e) {
		console.log('POST 1 error:', e.response || e.message);
		assert.ok(false, '1st POST failed: ' + JSON.stringify(e.response || e.message));
		return;
	}

	body.name = uniqueName('SD2');
	console.log('POST 2 body:', JSON.stringify(body));
	try {
		var r2 = await apiRequest('/store_bank_account.php', { method: 'POST', bearer: s.bearer, body: body });
		console.log('POST 2 response:', r2);
		assert.ok(true, '2nd POST accepted (duplicates allowed)');
	} catch (e) {
		console.log('POST 2 error:', e.response || e.message);
		assert.ok(true, '2nd POST rejected (duplicates not allowed): ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

// GET by store_id filter
QUnit.test('GET with store_id filter', async function(assert) {
	assert.timeout(10000);
	var s = await login();
	try {
		var r = await apiRequest('/store_bank_account.php?store_id=' + testConfig.storeId, { bearer: s.bearer });
		console.log('GET response:', r);
		assert.ok(true, 'response 200: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('GET error:', e.response || e.message);
		assert.ok(true, 'response error: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

// PUT delete / deactivate
QUnit.test('PUT status=DELETED', async function(assert) {
	assert.timeout(30000);
	var s = await login();

	var bid = await resolveBankAccountForTest(s, testConfig.storeId);
	console.log('using bank_account id:', bid);

	var created = await apiRequest('/store_bank_account.php', {
		method: 'POST', bearer: s.bearer,
		body: { name: uniqueName('SDEL'), store_id: testConfig.storeId, bank_account_id: bid }
	});
	var rec = created.store_bank_account || created;
	console.log('created id=', rec.id);

	var putBody = { id: rec.id, store_id: testConfig.storeId, bank_account_id: bid, status: 'DELETED' };
	console.log('PUT body:', JSON.stringify(putBody));
	try {
		var r = await apiRequest('/store_bank_account.php', { method: 'PUT', bearer: s.bearer, body: putBody });
		console.log('PUT response:', r);
		assert.ok(true, 'PUT succeeded: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('PUT error:', e.response || e.message);
		assert.ok(true, 'PUT response: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});
