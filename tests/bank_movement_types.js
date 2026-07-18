QUnit.module('bank_movement transaction types', function() {
	var TRANSACTION_TYPES = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'];

	async function ensureStoreBankAccountForType(session, storeId, transactionType) {
		var existing = await apiRequest(
			'/store_bank_account.php?store_id=' + storeId + '&default_transaction_type=' + transactionType,
			{ bearer: session.bearer }
		);
		var rows = existing.data || existing.result || [];
		if (rows.length > 0) {
			var sba = rows[0].store_bank_account || rows[0];
			console.log('Reusing store_bank_account id=' + sba.id + ' for ' + transactionType);
			return { bankAccountId: sba.bank_account_id, storeBankAccountId: sba.id };
		}

		var accounts = await apiRequest(
			'/bank_account.php?_sort=id_DESC',
			{ bearer: session.bearer }
		);
		var accountRows = accounts.data || accounts.result || [];
		var bankAccountId;
		var totalAccounts = accounts.total || accountRows.length;
		if (totalAccounts > 5) {
			var ba = accountRows[0];
			if (ba && ba.bank_account) ba = ba.bank_account;
			if (!ba || !ba.id) {
				throw new Error('Could not find bank_account id');
			}
			bankAccountId = ba.id;
		} else {
			var created = await apiRequest('/bank_account.php', {
				method: 'POST',
				bearer: session.bearer,
				body: {
					name: uniqueName('ba-' + transactionType.toLowerCase()),
					alias: uniqueName(transactionType.toLowerCase()),
					bank: 'TB',
					account: 'ACC' + transactionType + Date.now(),
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
				name: uniqueName('sba-' + transactionType.toLowerCase()),
				store_id: storeId,
				bank_account_id: bankAccountId,
				default_transaction_type: transactionType
			}
		});
		var sbaId = (storeBank && storeBank.store_bank_account) ? storeBank.store_bank_account.id : storeBank.id;

		console.log('Created store_bank_account id=' + sbaId + ' for ' + transactionType);
		return { bankAccountId: bankAccountId, storeBankAccountId: sbaId };
	}

	function paymentPayloadForType(orderId, total, userId, transactionType) {
		var syncIdentifier = createPaymentSyncIdentifier(userId);
		var paymentData = {
			type: 'income',
			tag: 'SALE',
			payment_amount: total,
			received_amount: total,
			change_amount: 0,
			currency_id: 'MXN'
		};
		Object.keys(syncIdentifier).forEach(function(k) {
			paymentData[k] = syncIdentifier[k];
		});

		return {
			movements: [{
				bank_movement: {
					transaction_type: transactionType,
					client_user_id: null,
					total: total,
					amount_received: total,
					currency_id: 'MXN',
					exchange_rate: 1,
					type: 'income'
				},
				bank_movement_orders: [{
					currency_amount: total,
					amount: total,
					currency_id: 'MXN',
					exchange_rate: 1,
					order_id: orderId
				}]
			}],
			payment: paymentData
		};
	}

	async function createOrderAndPayment(session, assert, transactionType) {
		var storeId = session.user.store_id || testConfig.storeId;
		var { bankAccountId } = await ensureStoreBankAccountForType(session, storeId, transactionType);
		assert.ok(bankAccountId, '[' + transactionType + '] have bank_account id=' + bankAccountId);

		var itemIds = await createBackendSaleItems(session.bearer);
		assert.equal(itemIds.length, 7, '[' + transactionType + '] items created');

		var orderInfo = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: backendSaleOrderPayload(itemIds, session.user.id)
		});
		assert.ok(orderInfo.order && orderInfo.order.id, '[' + transactionType + '] order created id=' + orderInfo.order.id);

		var payload = paymentPayloadForType(orderInfo.order.id, orderInfo.order.total, session.user.id, transactionType);
		var paymentInfo = await apiRequest('/payment_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: payload
		});

		assert.ok(paymentInfo.payment && paymentInfo.payment.id, '[' + transactionType + '] payment created id=' + paymentInfo.payment.id);
		assert.ok(paymentInfo.movements && paymentInfo.movements.length > 0, '[' + transactionType + '] payment has movements');

		var bankMovement = paymentInfo.movements[0].bank_movement;
		assert.ok(bankMovement.id, '[' + transactionType + '] bank_movement created id=' + bankMovement.id);
		assert.equal(bankMovement.transaction_type, transactionType,
			'[' + transactionType + '] bank_movement.transaction_type is ' + transactionType);
		assert.ok(bankMovement.bank_account_id, '[' + transactionType + '] bank_movement has bank_account_id');

		var paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
		assert.equal(Number(paidOrderId), Number(orderInfo.order.id), '[' + transactionType + '] payment links correct order');

		var reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(paidOrderId), { bearer: session.bearer });
		assert.equal(reloadedOrder.order.paid_status, 'PAID', '[' + transactionType + '] order PAID');

		var bmResult = await apiRequest('/bank_movement.php?id=' + bankMovement.id, { bearer: session.bearer });
		var bm = bmResult.bank_movement || bmResult;
		var bmData = bm.data ? (Array.isArray(bm.data) ? bm.data[0] : bm.data) : bm;
		assert.ok(bmData && (bmData.id || bmData.bank_movement),
			'[' + transactionType + '] bank_movement queryable via GET');
	}

	TRANSACTION_TYPES.forEach(function(transactionType) {
		QUnit.test('bank_movement ' + transactionType, async function(assert) {
			assert.timeout(60000);

			var session = await login();
			assert.ok(session.bearer, '[' + transactionType + '] logged in');

			await createOrderAndPayment(session, assert, transactionType);
		});
	});
});
