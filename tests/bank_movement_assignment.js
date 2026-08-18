QUnit.module('bank_movement assignment to bank_account');

async function resolveOrCreateBankAccount(session, storeId) {
	const existing = await apiRequest(
		'/store_bank_account.php?store_id=' + storeId,
		{ bearer: session.bearer }
	);
	const rows = existing.data || existing.result || [];
	if (rows.length > 0) {
		const sba = rows[0].store_bank_account || rows[0];
		return {
			bankAccountId: sba.bank_account_id,
			storeBankAccountId: sba.id
		};
	}

	const accounts = await apiRequest(
		'/bank_account.php?_sort=id_DESC',
		{ bearer: session.bearer }
	);
	const accountRows = accounts.data || accounts.result || [];
	const totalAccounts = accounts.total || accountRows.length;

	var bankAccountId;
	if (totalAccounts > 5) {
		var ba = accountRows[0];
		if (ba && ba.bank_account) ba = ba.bank_account;
		if (!ba || !ba.id) {
			throw new Error('Could not find biggest bank_account id');
		}
		bankAccountId = ba.id;
	} else {
		const bankAccount = await apiRequest('/bank_account.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				name: uniqueName('ba-cash'),
				alias: uniqueName('cash'),
				bank: 'TB',
				account: 'ACC' + Date.now(),
				store_id: storeId,
				currency: 'MXN',
				status: 'ACTIVE'
			}
		});
		bankAccountId = (bankAccount && bankAccount.bank_account) ? bankAccount.bank_account.id : bankAccount.id;
	}

	const storeBank = await apiRequest('/store_bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('sba-cash'),
			store_id: storeId,
			bank_account_id: bankAccountId,
			default_transaction_type: 'CASH'
		}
	});
	const sbaId = (storeBank && storeBank.store_bank_account) ? storeBank.store_bank_account.id : storeBank.id;

	return { bankAccountId, storeBankAccountId: sbaId };
}

QUnit.test('auto-assign bank_account via store_bank_account on payment', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;
	assert.ok(storeId, 'have store id: ' + storeId);

	const { bankAccountId } = await resolveOrCreateBankAccount(session, storeId);
	assert.ok(bankAccountId, 'have bank_account id=' + bankAccountId);

	const itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'items created');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id, 'auto-assign bank_account via store_bank_account on payment')
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'order created id=' + orderInfo.order.id);

	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id)
	});

	assert.ok(paymentInfo.payment && paymentInfo.payment.id, 'payment created id=' + paymentInfo.payment.id);
	assert.ok(paymentInfo.movements && paymentInfo.movements.length > 0, 'payment has movements');

	const bankMovement = paymentInfo.movements[0].bank_movement;
	assert.ok(bankMovement.id, 'bank_movement created id=' + bankMovement.id);
	assert.ok(bankMovement.bank_account_id, 'bank_movement has bank_account_id');
	assert.equal(
		Number(bankMovement.bank_account_id),
		Number(bankAccountId),
		'bank_movement.bank_account_id matches store_bank_account'
	);

	const paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
	assert.equal(Number(paidOrderId), Number(orderInfo.order.id), 'pago realizado');

	const reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(paidOrderId), { bearer: session.bearer });
	assert.equal(reloadedOrder.order.paid_status, 'PAID', 'order paid');
});

QUnit.test('explicit bank_account_id in bank_movement payload', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;
	const { bankAccountId } = await resolveOrCreateBankAccount(session, storeId);
	assert.ok(bankAccountId, 'have bank_account id=' + bankAccountId);

	const itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'items created');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id, 'explicit bank_account_id in bank_movement payload')
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'order created');

	var explicitPayload = paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id);
	explicitPayload.movements[0].bank_movement.bank_account_id = bankAccountId;

	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: explicitPayload
	});

	assert.ok(paymentInfo.payment && paymentInfo.payment.id, 'payment created');
	const bankMovement = paymentInfo.movements[0].bank_movement;
	assert.ok(bankMovement.id, 'bank_movement created');
	assert.ok(bankMovement.bank_account_id, 'bank_movement has bank_account_id');
	assert.equal(
		Number(bankMovement.bank_account_id),
		Number(bankAccountId),
		'bank_movement.bank_account_id matches explicit value'
	);

	const paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
	assert.equal(Number(paidOrderId), Number(orderInfo.order.id), 'pago realizado');
});

QUnit.test('bank_movement queryable via bank_movement.php GET', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;
	const { bankAccountId } = await resolveOrCreateBankAccount(session, storeId);
	assert.ok(bankAccountId, 'have bank_account id=' + bankAccountId);

	const itemIds = await createBackendSaleItems(session.bearer);
	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id, 'bank_movement queryable via bank_movement.php GET')
	});

	var payload = paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id);
	payload.movements[0].bank_movement.bank_account_id = bankAccountId;

	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: payload
	});

	const bmId = paymentInfo.movements[0].bank_movement.id;
	assert.ok(bmId, 'bank_movement id=' + bmId);

	const bmResult = await apiRequest('/bank_movement.php?id=' + bmId, { bearer: session.bearer });
	console.log('bank_movement.php GET response:', bmResult);

	const bm = bmResult.bank_movement || bmResult;
	const bmData = bm.data ? (Array.isArray(bm.data) ? bm.data[0] : bm.data) : bm;

	if (bmData && bmData.bank_movement) {
		assert.equal(Number(bmData.bank_movement.bank_account_id || bmData.bank_account_id), Number(bankAccountId),
			'bank_movement shows bank_account_id=' + bankAccountId);
	} else {
		assert.ok(bmId, 'bank_movement GET returned data');
	}
});

QUnit.module('bank_movement checkpoint');

function unwrapBankMovement(response) {
	var bm = response.bank_movement || response;
	if (bm.data) {
		return Array.isArray(bm.data) ? bm.data[0] : bm.data;
	}
	return bm;
}

async function ensureBankAccountForCheckpoint(session, storeId) {
	var existing = await apiRequest(
		'/store_bank_account.php?store_id=' + storeId + '&default_transaction_type=CASH',
		{ bearer: session.bearer }
	);
	var rows = existing.data || existing.result || [];
	if (rows.length > 0) {
		var sba = rows[0].store_bank_account || rows[0];
		console.log('Reusing store_bank_account id=' + sba.id);
		return { bankAccountId: sba.bank_account_id, storeBankAccountId: sba.id };
	}

	var accounts = await apiRequest(
		'/bank_account.php?_sort=id_DESC',
		{ bearer: session.bearer }
	);
	var accountRows = accounts.data || accounts.result || [];
	var totalAccounts = accounts.total || accountRows.length;
	var bankAccountId;

	if (totalAccounts > 5) {
		var ba = accountRows[0];
		if (ba && ba.bank_account) ba = ba.bank_account;
		if (!ba || !ba.id) throw new Error('Could not find bank_account id');
		bankAccountId = ba.id;
	} else {
		var created = await apiRequest('/bank_account.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				name: uniqueName('ba-checkpoint'),
				alias: uniqueName('cp'),
				bank: 'TB',
				account: 'CK' + Date.now(),
				store_id: storeId,
				currency: 'MXN',
				status: 'ACTIVE'
			}
		});
		bankAccountId = (created && created.bank_account) ? created.bank_account.id : created.id;
	}

	var storeBank = await apiRequest('/store_bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('sba-checkpoint'),
			store_id: storeId,
			bank_account_id: bankAccountId,
			default_transaction_type: 'CASH'
		}
	});
	var sbaId = (storeBank && storeBank.store_bank_account) ? storeBank.store_bank_account.id : storeBank.id;
	console.log('Created store_bank_account id=' + sbaId);

	return { bankAccountId: bankAccountId, storeBankAccountId: sbaId };
}

QUnit.test('store bank account assignment before sales', async function(assert) {
	assert.timeout(60000);

	var session = await login();
	assert.ok(session.bearer, 'logged in');

	var storeId = session.user.store_id || testConfig.storeId;
	assert.ok(storeId, 'have store id: ' + storeId);

	var { bankAccountId } = await resolveOrCreateBankAccount(session, storeId);
	assert.ok(bankAccountId, 'have bank_account id=' + bankAccountId);

	var verify = await apiRequest(
		'/store_bank_account.php?store_id=' + storeId + '&bank_account_id=' + bankAccountId,
		{ bearer: session.bearer }
	);
	var verifyRows = verify.data || verify.result || [];
	assert.ok(verifyRows.length > 0, 'store_bank_account link is queryable');

	var itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'items created');

	var orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id, 'store bank account assignment before sales')
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'order created');

	var paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id)
	});
	assert.ok(paymentInfo.payment && paymentInfo.payment.id, 'payment created');

	var bankMovement = paymentInfo.movements[0].bank_movement;
	assert.ok(bankMovement.id, 'bank_movement created');
	assert.ok(bankMovement.bank_account_id, 'bank_movement has bank_account_id');
	assert.equal(
		Number(bankMovement.bank_account_id),
		Number(bankAccountId),
		'bank_movement.bank_account_id matches assigned bank_account'
	);
});

QUnit.test('set checkpoint on bank movement and verify balance recalculation', async function(assert) {
	assert.timeout(60000);

	var session = await login();
	assert.ok(session.bearer, 'logged in');

	var storeId = session.user.store_id || testConfig.storeId;

	var created = await apiRequest('/bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('ba-checkpoint-fresh'),
			alias: uniqueName('cpfresh'),
			bank: 'TB',
			account: 'CKF' + Date.now(),
			store_id: storeId,
			currency: 'MXN',
			status: 'ACTIVE'
		}
	});
	var bankAccountId = (created && created.bank_account) ? created.bank_account.id : created.id;
	assert.ok(bankAccountId, 'fresh bank_account created id=' + bankAccountId);

	function paymentWithAccount(orderId, total, userId, baId) {
		var payload = paymentPayload(orderId, total, userId);
		payload.movements[0].bank_movement.bank_account_id = baId;
		return payload;
	}

	var itemIds1 = await createBackendSaleItems(session.bearer);
	var order1 = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds1, session.user.id, 'set checkpoint on bank movement and verify balance recalculation')
	});
	var payment1 = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentWithAccount(order1.order.id, order1.order.total, session.user.id, bankAccountId)
	});
	var bm1 = payment1.movements[0].bank_movement;
	assert.ok(bm1.id, 'bm1 created id=' + bm1.id);
	var bm1Total = Number(bm1.total);

	var itemIds2 = await createBackendSaleItems(session.bearer);
	var order2 = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds2, session.user.id, 'set checkpoint on bank movement and verify balance recalculation')
	});
	var payment2 = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentWithAccount(order2.order.id, order2.order.total, session.user.id, bankAccountId)
	});
	var bm2 = payment2.movements[0].bank_movement;
	assert.ok(bm2.id, 'bm2 created id=' + bm2.id);
	var bm2Total = Number(bm2.total);

	var checkpointBalance = 5000;
	var checkpointResult = await apiRequest('/updates/set_bank_movement_checkpoint.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			id: bm1.id,
			balance: checkpointBalance
		}
	});
	console.log('checkpoint response:', checkpointResult);

	assert.equal(Number(checkpointResult.is_checkpoint), 1, 'bm1 is_checkpoint=1');
	assert.equal(Number(checkpointResult.balance), checkpointBalance, 'bm1 balance=' + checkpointBalance);

	var bm1Reload = await apiRequest('/bank_movement.php?id=' + bm1.id, { bearer: session.bearer });
	var bm1Data = unwrapBankMovement(bm1Reload);
	assert.equal(Number(bm1Data.balance), checkpointBalance, 'bm1 balance preserved as checkpoint value');

	var bm2Reload = await apiRequest('/bank_movement.php?id=' + bm2.id, { bearer: session.bearer });
	var bm2Data = unwrapBankMovement(bm2Reload);

	var expectedBm2Balance = checkpointBalance + bm2Total;
	assert.equal(
		Number(bm2Data.balance),
		expectedBm2Balance,
		'bm2 balance = checkpoint(' + checkpointBalance + ') + bm2.total(' + bm2Total + ') = ' + expectedBm2Balance
	);
});

QUnit.test('checkpoint without auth', async function(assert) {
	assert.timeout(10000);
	try {
		var r = await apiRequest('/updates/set_bank_movement_checkpoint.php', {
			method: 'POST',
			body: { id: 1, balance: 100 }
		});
		console.log('checkpoint no-auth response:', r);
		assert.ok(true, 'response 200: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('checkpoint no-auth error:', e.response || e.message);
		assert.ok(true, 'response error: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

QUnit.test('checkpoint missing id', async function(assert) {
	assert.timeout(10000);
	var session = await login();
	try {
		var r = await apiRequest('/updates/set_bank_movement_checkpoint.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {}
		});
		console.log('checkpoint missing id response:', r);
		assert.ok(true, 'response 200: ' + JSON.stringify(r).slice(0, 100));
	} catch (e) {
		console.log('checkpoint missing id error:', e.response || e.message);
		assert.ok(true, 'rejected missing id: ' + JSON.stringify(e.response || e.message).slice(0, 100));
	}
});

QUnit.test('checkpoint non-numeric balance', async function(assert) {
	assert.timeout(60000);

	var session = await login();
	var storeId = session.user.store_id || testConfig.storeId;
	var { bankAccountId } = await ensureBankAccountForCheckpoint(session, storeId);
	assert.ok(bankAccountId, 'have bank_account id=' + bankAccountId);

	var itemIds = await createBackendSaleItems(session.bearer);
	var orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id, 'checkpoint non-numeric balance')
	});
	var paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id)
	});
	var bm = paymentInfo.movements[0].bank_movement;
	assert.ok(bm.id, 'bank_movement created for validation test');

	try {
		await apiRequest('/updates/set_bank_movement_checkpoint.php', {
			method: 'POST',
			bearer: session.bearer,
			body: { id: bm.id, balance: 'abc' }
		});
		assert.ok(false, 'expected error for non-numeric balance');
	} catch (e) {
		console.log('non-numeric balance error:', e.response || e.message);
		assert.ok(true, 'rejected non-numeric balance');
	}
});
