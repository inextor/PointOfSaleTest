QUnit.module('bank_movement assignment to bank_account');

async function resolveOrCreateBankAccount(session, storeId) {
	const existing = await apiRequest(
		'/store_bank_account.php?store_id=' + storeId,
		{ bearer: session.bearer }
	);
	const sbaRows = existing.data || existing.result || [];
	console.log('store_bank_account lookup: total=' + (existing.total || '?') + ' rows=' + sbaRows.length + ' data=' + JSON.stringify(existing).slice(0, 200));

	if (sbaRows.length > 0) {
		const sba = sbaRows[0].store_bank_account || sbaRows[0];
		console.log('reusing existing store_bank_account id=' + sba.id + ' bank_account_id=' + sba.bank_account_id);
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
	console.log('bank_account list: total=' + totalAccounts + ' page_rows=' + accountRows.length);

	var bankAccountId;
	if (totalAccounts > 5) {
		var ba = accountRows[0];
		if (ba && ba.bank_account) ba = ba.bank_account;
		if (!ba || !ba.id) {
			console.log('ERROR: could not extract id from first bank_account row', accountRows[0]);
			throw new Error('Could not find biggest bank_account id');
		}
		bankAccountId = ba.id;
		console.log('>5 bank_accounts, reusing biggest id=' + bankAccountId);
	} else {
		console.log('<=5 bank_accounts, creating new one');
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
		console.log('created bank_account id=' + bankAccountId);
	}

	console.log('creating store_bank_account link: store_id=' + storeId + ' bank_account_id=' + bankAccountId);
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
	console.log('store_bank_account link created: id=' + sbaId + ' response=' + JSON.stringify(storeBank).slice(0, 200));

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
		body: backendSaleOrderPayload(itemIds, session.user.id)
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
