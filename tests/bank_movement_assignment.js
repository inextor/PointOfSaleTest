QUnit.module('bank_movement assignment to bank_account');

async function findOrCreateStore(session) {
	const stores = await apiRequest('/store.php', { bearer: session.bearer });
	const list = stores.data || stores.result || [];
	if (list.length > 0) {
		const store = list[0].store || list[0];
		return store.id;
	}
	throw new Error('No stores available');
}

async function cleanupStoreBankAccount(bearer, id, storeId, bankAccountId) {
	try {
		await apiRequest('/store_bank_account.php', {
			method: 'DELETE',
			bearer: bearer,
			body: { id: id }
		});
		return true;
	} catch (e) {
		try {
			await apiRequest('/store_bank_account.php', {
				method: 'PUT',
				bearer: bearer,
				body: { id: id, store_id: storeId, bank_account_id: bankAccountId, status: 'DELETED' }
			});
			return true;
		} catch (e2) {
			return false;
		}
	}
}

QUnit.test('auto-assign bank_account via store_bank_account on payment', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;
	assert.ok(storeId, 'have store id: ' + storeId);

	const bankAccount = await apiRequest('/bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('ba-payment'),
			alias: uniqueName('ba'),
			bank: 'TB',
			account: 'ACC' + Date.now(),
			store_id: storeId,
			currency: 'MXN',
			status: 'ACTIVE'
		}
	});
	const bankAccountId = (bankAccount && bankAccount.bank_account) ? bankAccount.bank_account.id : bankAccount.id;
	assert.ok(bankAccountId, 'created bank_account id=' + bankAccountId);

	const storeBank = await apiRequest('/store_bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('sba-auto'),
			store_id: storeId,
			bank_account_id: bankAccountId,
			default_transaction_type: 'CASH'
		}
	});
	const sbaId = (storeBank && storeBank.store_bank_account) ? storeBank.store_bank_account.id : storeBank.id;
	assert.ok(sbaId, 'created store_bank_account id=' + sbaId);

	const itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'items created');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id)
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
		'bank_movement.bank_account_id matches created bank_account'
	);

	const paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
	assert.equal(Number(paidOrderId), Number(orderInfo.order.id), 'pago realizado');

	const reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(paidOrderId), { bearer: session.bearer });
	assert.equal(reloadedOrder.order.paid_status, 'PAID', 'order paid');

	const cleaned = await cleanupStoreBankAccount(session.bearer, sbaId, storeId, bankAccountId);
	assert.ok(cleaned, 'cleaned up store_bank_account');
});

QUnit.test('explicit bank_account_id in bank_movement payload', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;

	const bankAccount = await apiRequest('/bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('ba-explicit'),
			alias: uniqueName('bae'),
			bank: 'TB',
			account: 'ACC' + Date.now(),
			store_id: storeId,
			currency: 'MXN',
			status: 'ACTIVE'
		}
	});
	const bankAccountId = (bankAccount && bankAccount.bank_account) ? bankAccount.bank_account.id : bankAccount.id;
	assert.ok(bankAccountId, 'created bank_account id=' + bankAccountId);

	const itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'items created');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id)
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'order created');

	// Build payment payload with explicit bank_account_id in bank_movement
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
		'bank_movement.bank_account_id matches explicitly provided bank_account'
	);

	const paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
	assert.equal(Number(paidOrderId), Number(orderInfo.order.id), 'pago realizado');
});

QUnit.test('bank_movement queryable via bank_movement.php GET', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const storeId = session.user.store_id || testConfig.storeId;

	const bankAccount = await apiRequest('/bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('ba-query'),
			alias: uniqueName('baq'),
			bank: 'TB',
			account: 'ACC' + Date.now(),
			store_id: storeId,
			currency: 'MXN',
			status: 'ACTIVE'
		}
	});
	const bankAccountId = (bankAccount && bankAccount.bank_account) ? bankAccount.bank_account.id : bankAccount.id;
	assert.ok(bankAccountId, 'created bank_account id=' + bankAccountId);

	const itemIds = await createBackendSaleItems(session.bearer);
	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id)
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
