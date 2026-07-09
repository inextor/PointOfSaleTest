function commissionDiscountPercent(orderItem) {
	if (Number(orderItem.discount_percent || 0) > 0) {
		return Number(orderItem.discount_percent);
	}

	if (Number(orderItem.original_unitary_price || 0) > 0 && Number(orderItem.original_unitary_price) > Number(orderItem.unitary_price || 0)) {
		return ((Number(orderItem.original_unitary_price) - Number(orderItem.unitary_price || 0)) / Number(orderItem.original_unitary_price)) * 100;
	}

	return 0;
}

function calculateTestCommission(item, orderItem, rule) {
	if (item.commission_type === 'AMOUNT') {
		return Number(orderItem.qty || 0) * Number(item.commission || 0);
	}

	if (item.commission_type === 'PERCENT') {
		return Number(orderItem.total || 0) * Number(item.commission || 0) / 100;
	}

	if (item.commission_type === 'RULE_PERCENT') {
		if (!rule || rule.status !== 'ACTIVE') {
			return 0;
		}

		const finalPercent = Math.max(
			0,
			Number(rule.base_percent || 0) - (commissionDiscountPercent(orderItem) * Number(rule.discount_reduction_per_percent || 0))
		);

		return Number(orderItem.total || 0) * finalPercent / 100;
	}

	return 0;
}

function findTestCommissionRule(order, rules) {
	return (rules || []).find((rule) => {
		return rule.status === 'ACTIVE'
			&& Number(rule.store_id) === Number(order.store_id)
			&& Number(rule.price_type_id) === Number(order.price_type_id);
	}) || null;
}

function calculateTestOrderCommission(order, items, rules) {
	const rule = findTestCommissionRule(order, rules);

	return items.reduce((summary, row) => {
		const commission = calculateTestCommission(row.item, row.order_item, rule);
		summary.lines.push(commission);
		summary.total += commission;
		return summary;
	}, { lines: [], total: 0 });
}

function assertMoneyEqual(assert, actual, expected, message) {
	assert.ok(
		Math.abs(Number(actual) - Number(expected)) < 0.01,
		message + ' expected ' + expected + ' got ' + actual
	);
}

async function createCommissionTestClient(session, storeId, priceTypeId) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName('Commission Report Client'),
			price_type_id: priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Commission client creation did not return id: ' + JSON.stringify(client));
	}

	return client;
}

async function createCommissionTestItem(session, commissionType, commission) {
	const item = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			item: {
				applicable_tax: 'EXEMPT',
				availability_type: 'ALWAYS',
				clave_sat: '53111603',
				commission: commission,
				commission_currency_id: 'MXN',
				commission_type: commissionType,
				currency_id: 'MXN',
				name: uniqueName('Commission ' + commissionType),
				note_required: 'NO',
				on_sale: 'YES',
				reference_price: 0,
				status: 'ACTIVE',
				unidad_medida_sat_id: 'H87'
			}
		}
	});

	if (!item.item || !item.item.id || item.item.commission_type !== commissionType) {
		throw new Error('Commission item creation failed: ' + JSON.stringify(item));
	}

	return item.item;
}

async function ensureCommissionRule(session, storeId, priceTypeId, basePercent, discountReductionPerPercent) {
	const search = await apiRequest(
		'/commission_rule.php?limit=9999',
		{ bearer: session.bearer }
	);

	const existingRows = search.data || search.result || [];
	const existing = existingRows.find((rule) => {
		return Number(rule.store_id) === Number(storeId)
			&& Number(rule.price_type_id) === Number(priceTypeId);
	});

	const payload = {
		base_percent: basePercent,
		discount_reduction_per_percent: discountReductionPerPercent,
		price_type_id: priceTypeId,
		status: 'ACTIVE',
		store_id: storeId
	};

	if (existing && existing.id) {
		const updated = await apiRequest('/commission_rule.php', {
			method: 'PUT',
			bearer: session.bearer,
			body: { ...payload, id: existing.id }
		});

		return updated;
	}

	return apiRequest('/commission_rule.php', {
		method: 'POST',
		bearer: session.bearer,
		body: payload
	});
}

function commissionOrderItem(item, qty, unitaryPrice, total, extra) {
	return {
		order_item: {
			commanda_status: 'NOT_DISPLAYED',
			delivery_status: 'PENDING',
			discount: 0,
			discount_percent: 0,
			has_separator: 'NO',
			is_free_of_charge: 'NO',
			is_item_extra: 'NO',
			item_group: Date.now() + Math.floor(Math.random() * 10000),
			item_id: item.id,
			item_option_qty: 1,
			note: '',
			original_unitary_price: unitaryPrice,
			paid_qty: 0,
			preparation_status: 'PENDING',
			qty: qty,
			return_required: 'NO',
			status: 'ACTIVE',
			stock_status: 'IN_STOCK',
			subtotal: total,
			tax: 0,
			tax_included: 'NO',
			total: total,
			type: 'NORMAL',
			unitary_price: total / qty,
			unitary_price_meta: unitaryPrice,
			...(extra || {})
		}
	};
}

function commissionOrderPayload(session, client, storeId, priceTypeId, items) {
	const total = items.reduce((sum, row) => sum + Number(row.order_item.total || 0), 0);

	return {
		order: {
			amount_paid: 0,
			billing_data_id: 1,
			cashier_user_id: session.user.id,
			client_name: client.name,
			client_user_id: client.id,
			currency_id: 'MXN',
			discount: 0,
			paid_status: 'PENDING',
			price_type_id: priceTypeId,
			service_type: 'QUICK_SALE',
			status: 'CLOSED',
			store_id: storeId,
			subtotal: total,
			sync_id: createAgentSyncId(session.user.id),
			tax: 0,
			tax_percent: 0,
			total: total
		},
		items: items
	};
}

QUnit.module('Commission rule calculation');

QUnit.test('legacy amount and percent commissions remain unchanged', function(assert) {
	assert.equal(calculateTestCommission(
		{ commission_type: 'AMOUNT', commission: 12 },
		{ qty: 3, total: 100 },
		null
	), 36, 'amount commission uses qty times configured amount');

	assert.equal(calculateTestCommission(
		{ commission_type: 'PERCENT', commission: 5 },
		{ qty: 3, total: 200 },
		null
	), 10, 'percent commission uses sale total times item percent');
});

QUnit.test('store price type percent uses rule and stored discount percent', function(assert) {
	const commission = calculateTestCommission(
		{ commission_type: 'RULE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1, original_unitary_price: 1000, unitary_price: 990 },
		{ status: 'ACTIVE', base_percent: 2, discount_reduction_per_percent: 0.2 }
	);

	assert.equal(commission, 18, '2.00 base minus 0.20 for 1% discount gives 1.80% commission');
});

QUnit.test('store price type percent can derive discount from unit prices', function(assert) {
	const commission = calculateTestCommission(
		{ commission_type: 'RULE_PERCENT', commission: 0 },
		{ qty: 1, total: 900, discount_percent: 0, original_unitary_price: 1000, unitary_price: 900 },
		{ status: 'ACTIVE', base_percent: 5, discount_reduction_per_percent: 0.1 }
	);

	assert.equal(commission, 36, '10% derived discount lowers 5% commission to 4%');
});

QUnit.test('missing inactive and excessive discount rules return safe values', function(assert) {
	assert.equal(calculateTestCommission(
		{ commission_type: 'RULE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1 },
		null
	), 0, 'missing rule returns zero');

	assert.equal(calculateTestCommission(
		{ commission_type: 'RULE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1 },
		{ status: 'DELETED', base_percent: 2, discount_reduction_per_percent: 0.2 }
	), 0, 'inactive rule returns zero');

	assert.equal(calculateTestCommission(
		{ commission_type: 'RULE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 50 },
		{ status: 'ACTIVE', base_percent: 2, discount_reduction_per_percent: 0.2 }
	), 0, 'final commission percent is clamped to zero');
});

QUnit.test('full order supports the three commission assignment forms', function(assert) {
	const order = {
		store_id: 1,
		price_type_id: 1,
		total: 2500
	};

	const summary = calculateTestOrderCommission(order, [
		{
			item: { commission_type: 'AMOUNT', commission: 12 },
			order_item: { qty: 3, total: 300, discount_percent: 0 }
		},
		{
			item: { commission_type: 'PERCENT', commission: 5 },
			order_item: { qty: 1, total: 200, discount_percent: 0 }
		},
		{
			item: { commission_type: 'RULE_PERCENT', commission: 0 },
			order_item: { qty: 1, total: 1000, discount_percent: 1, original_unitary_price: 1000, unitary_price: 990 }
		}
	], [
		{ status: 'ACTIVE', store_id: 1, price_type_id: 1, base_percent: 2, discount_reduction_per_percent: 0.2 },
		{ status: 'ACTIVE', store_id: 2, price_type_id: 1, base_percent: 9, discount_reduction_per_percent: 0 }
	]);

	assert.deepEqual(summary.lines, [36, 10, 18], 'amount, item percent, and store/price-type rule commissions are assigned independently');
	assert.equal(summary.total, 64, 'full order commission sums the three assignment forms');
});

	QUnit.test('full commission report flow assigns amount percent and store price type commissions', async function(assert) {
		assert.timeout(60000);
		assert.expect(24);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const priceTypeId = 1;

		assert.ok(session.bearer, 'logged in');

	await ensureCommissionRule(session, storeId, priceTypeId, 2, 0.2);
	assert.ok(true, 'created or updated active commission rule for store and price type');

	const client = await createCommissionTestClient(session, storeId, priceTypeId);
	assert.ok(client.id, 'created commission test client assigned to the logged-in agent');

	const amountItem = await createCommissionTestItem(session, 'AMOUNT', 12);
	const percentItem = await createCommissionTestItem(session, 'PERCENT', 5);
	const ruleItem = await createCommissionTestItem(session, 'RULE_PERCENT', 0);
	assert.equal(amountItem.commission_type, 'AMOUNT', 'amount item stores commission assignment');
	assert.equal(percentItem.commission_type, 'PERCENT', 'percent item stores commission assignment');
	assert.equal(ruleItem.commission_type, 'RULE_PERCENT', 'rule item stores commission assignment');

		const orderItems = [
			commissionOrderItem(amountItem, 3, 100, 300),
			commissionOrderItem(percentItem, 1, 200, 200),
			commissionOrderItem(ruleItem, 1, 1000, 990, {
				discount: 10,
				discount_percent: 1,
				subtotal: 1000,
				unitary_price: 990
			})
		];

		const startedAt = new Date(Date.now() - 2000);
		const orderInfo = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: commissionOrderPayload(session, client, storeId, priceTypeId, orderItems)
		});
		assert.ok(orderInfo.order && orderInfo.order.id, 'created closed commission test order');
		const orderId = orderInfo.order.id;

		const paymentInfo = await apiRequest('/payment_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: paymentPayload(orderId, orderInfo.order.total, session.user.id)
		});
		const paymentId = paymentInfo.payment && paymentInfo.payment.id;
		assert.ok(paymentId, 'paid commission test order');

		const endedAt = new Date(Date.now() + 2000);
		const date_start = mysqlDate(startedAt);
		const date_end = mysqlDate(endedAt);

		const summaryReport = await apiRequest(
			'/reports/getCommissionSummaryByAgent.php?date_start=' + encodeURIComponent(date_start)
			+ '&date_end=' + encodeURIComponent(date_end)
			+ '&order_id=' + encodeURIComponent(orderId),
			{ bearer: session.bearer }
		);
	const summaryAgent = summaryReport.find(row => Number(row.agent_id) === Number(session.user.id));
	assert.ok(summaryAgent, 'commission-report summary includes the logged-in agent');
	assertMoneyEqual(assert, summaryAgent.total_commission, 64, 'commission-report summary shows expected total commission');
	assertMoneyEqual(assert, summaryAgent.total_commission_paid, 64, 'commission-report summary shows expected paid commission');

		const salesReport = await apiRequest(
			'/reports/getCommissionSalesByAgent.php?agent_id=' + encodeURIComponent(session.user.id)
			+ '&date_start=' + encodeURIComponent(date_start)
			+ '&date_end=' + encodeURIComponent(date_end)
			+ '&order_id=' + encodeURIComponent(orderId),
			{ bearer: session.bearer }
		);
		const saleReportRow = salesReport.find(row => Number(row.order_id) === Number(orderId));
		assert.ok(saleReportRow, 'commission-report sales expansion includes the created order');
		assertMoneyEqual(assert, saleReportRow.total_commission, 64, 'commission-report sales expansion shows expected total commission');

		const itemsReport = await apiRequest('/reports/getCommissionItemsByOrder.php?order_id=' + encodeURIComponent(orderId), {
			bearer: session.bearer
		});

	assert.equal(itemsReport.length, 3, 'item commission report returns the three test lines');
	const itemCommissions = itemsReport.map(row => Number(row.commission)).sort((a, b) => a - b);
	assertMoneyEqual(assert, itemCommissions[0], 10, 'percent item commission is in item report');
	assertMoneyEqual(assert, itemCommissions[1], 18, 'store price type rule commission is in item report');
	assertMoneyEqual(assert, itemCommissions[2], 36, 'amount item commission is in item report');

	const paymentItemsReport = await apiRequest('/reports/getCommissionItemsByOrderByPayment.php', {
		method: 'POST',
			bearer: session.bearer,
			body: {
				order_id: orderId,
				date_start,
				date_end
			}
	});

	const paymentItemTotal = paymentItemsReport.items.reduce((sum, row) => sum + Number(row.commission_paid_in_period || 0), 0);
	assertMoneyEqual(assert, paymentItemTotal, 64, 'payment item report pays the full expected commission');

	const paymentSummaryReport = await apiRequest('/reports/getCommissionSummaryByAgentByPayment.php', {
		method: 'POST',
		bearer: session.bearer,
			body: {
				date_start,
				date_end,
				billing_status: 'ALL',
				order_id: orderId
			}
		});
	const paymentSummaryAgent = paymentSummaryReport.find(row => Number(row.agent_id) === Number(session.user.id));
	assert.ok(paymentSummaryAgent, 'payment-commission-report summary includes the logged-in agent');
	assertMoneyEqual(assert, paymentSummaryAgent.total_commission, 64, 'payment-commission-report summary shows expected total commission');
	assertMoneyEqual(assert, paymentSummaryAgent.total_commission_paid, 64, 'payment-commission-report summary shows expected paid commission');

	const paymentSalesReport = await apiRequest('/reports/getCommissionSalesByAgentByPayment.php', {
		method: 'POST',
		bearer: session.bearer,
			body: {
				agent_id: session.user.id,
				date_start,
				date_end,
				billing_status: 'ALL',
				order_id: orderId
			}
		});

		const reportSale = paymentSalesReport.find(row => Number(row.order_id) === Number(orderId));
		assert.ok(reportSale, 'payment commission sales report includes the created order');
		assertMoneyEqual(assert, reportSale.commission_paid_in_period, 64, 'payment commission sales report shows the expected non-zero commission');

	const affiliatesReport = await apiRequest(
			'/reportes.php?report_name=affiliatesSales'
			+ '&date_start=' + encodeURIComponent(date_start)
			+ '&date_end=' + encodeURIComponent(date_end)
			+ '&include_nulls=NO'
			+ '&order_id=' + encodeURIComponent(orderId),
			{ bearer: session.bearer }
		);
	const affiliatesAgentTotal = affiliatesReport
		.filter(row => Number(row.user_id) === Number(session.user.id))
		.reduce((sum, row) => sum + Number(row.commission_fee || 0), 0);
		assertMoneyEqual(assert, affiliatesAgentTotal, 64, 'affiliates-sales report shows the same backend-calculated commission');
	});

	QUnit.test('zero commission payment generation marks the order payment as generated', async function(assert) {
		assert.timeout(60000);
		assert.expect(14);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const priceTypeId = 1;

		assert.ok(session.bearer, 'logged in');

		const client = await createCommissionTestClient(session, storeId, priceTypeId);
		const noCommissionItem = await createCommissionTestItem(session, 'NONE', 0);
		assert.equal(noCommissionItem.commission_type, 'NONE', 'created item without commission');

		const orderItems = [
			commissionOrderItem(noCommissionItem, 1, 100, 100)
		];

		const startedAt = new Date(Date.now() - 2000);
		const orderInfo = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: commissionOrderPayload(session, client, storeId, priceTypeId, orderItems)
		});
		assert.ok(orderInfo.order && orderInfo.order.id, 'created zero commission order');
		const orderId = orderInfo.order.id;

		const paymentInfo = await apiRequest('/payment_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: paymentPayload(orderId, orderInfo.order.total, session.user.id)
		});
		const paymentId = paymentInfo.payment && paymentInfo.payment.id;
		assert.ok(paymentId, 'paid zero commission order');

		const endedAt = new Date(Date.now() + 2000);
		const date_start = mysqlDate(startedAt);
		const date_end = mysqlDate(endedAt);

		const pendingBefore = await apiRequest('/reports/getCommissionSalesByAgentByPayment.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				agent_id: session.user.id,
				date_start,
				date_end,
				billing_status: 'PENDING',
				order_id: orderId
			}
		});
		const pendingRow = pendingBefore.find(row => Number(row.order_id) === Number(orderId));
		assert.ok(pendingRow, 'zero commission row starts as pending');
		assertMoneyEqual(assert, pendingRow.commission_paid_in_period, 0, 'pending zero commission row has zero amount');

		const generated = await apiRequest('/generate_commission_bills.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				selections: [{ order_id: orderId, payment_id: paymentId }]
			}
		});
		assert.equal(generated.status, 'success', 'zero commission generation succeeds');
		assert.equal(generated.generated_commission_ids.length, 1, 'zero commission generation creates a generated marker');
		assert.equal(generated.generated_bill_ids.length, 0, 'zero commission generation does not create a bill');

		const pendingAfter = await apiRequest('/reports/getCommissionSalesByAgentByPayment.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				agent_id: session.user.id,
				date_start,
				date_end,
				billing_status: 'PENDING',
				order_id: orderId
			}
		});
		assert.notOk(pendingAfter.find(row => Number(row.order_id) === Number(orderId)), 'zero commission row is no longer pending after generation');

		const billedAfter = await apiRequest('/reports/getCommissionSalesByAgentByPayment.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				agent_id: session.user.id,
				date_start,
				date_end,
				billing_status: 'BILLED',
				order_id: orderId
			}
		});
		const billedRow = billedAfter.find(row => Number(row.order_id) === Number(orderId));
		assert.ok(billedRow, 'zero commission row appears as generated after generation');
		assert.ok(billedRow.commission_id, 'generated zero commission row has a commission id');
		assert.notOk(billedRow.commission_bill_id, 'generated zero commission row has no bill id');
		assertMoneyEqual(assert, billedRow.commission_paid_in_period, 0, 'generated zero commission row still has zero amount');
	});

	QUnit.test('manual commission adjustment can be edited before bill generation', async function(assert) {
		assert.timeout(60000);
		assert.expect(9);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const concept = uniqueName('Manual Commission');

		assert.ok(session.bearer, 'logged in');

		const created = await apiRequest('/commission.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				agent_user_id: session.user.id,
				amount: 25,
				concept,
				currency_id: 'MXN',
				note: 'Initial manual commission test',
				store_id: storeId
			}
		});
		assert.ok(created.id, 'created manual commission adjustment');
		assertMoneyEqual(assert, created.amount, 25, 'manual adjustment stores initial amount');

		const updated = await apiRequest('/commission.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				action: 'update',
				id: created.id,
				agent_user_id: session.user.id,
				amount: 30,
				concept,
				currency_id: 'MXN',
				note: 'Updated manual commission test',
				store_id: storeId
			}
		});
		assertMoneyEqual(assert, updated.amount, 30, 'manual adjustment can be edited before generation');

		const generated = await apiRequest('/commission.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				action: 'generate_bills',
				ids: [created.id]
			}
		});
		assert.equal(generated.status, 'success', 'manual adjustment generation succeeds');
		assert.equal(generated.generated_bill_ids.length, 1, 'manual adjustment creates a payable bill');

		const reloaded = await apiRequest('/commission.php', {
			method: 'POST',
			bearer: session.bearer,
			body: { action: 'list' }
		});
		const adjustmentRows = Array.isArray(reloaded) ? reloaded : (reloaded.data || reloaded.result || []);
		const adjustment = adjustmentRows.find(row => Number(row.id) === Number(created.id)) || adjustmentRows[0];
		assert.ok(adjustment.bill_id, 'manual adjustment is linked to generated bill');

		try {
			await apiRequest('/commission.php', {
				method: 'POST',
				bearer: session.bearer,
				body: {
					action: 'update',
					id: created.id,
					agent_user_id: session.user.id,
					amount: 35,
					concept,
					currency_id: 'MXN',
					store_id: storeId
				}
			});
			assert.ok(false, 'generated manual adjustment cannot be edited');
		} catch (error) {
			assert.ok(true, 'generated manual adjustment cannot be edited');
		}

		const pendingBills = await apiRequest('/reports/getPendingCommissionBills.php', {
			method: 'POST',
			bearer: session.bearer
		});
		assert.ok(pendingBills.find(row => Number(row.bill_id) === Number(generated.generated_bill_ids[0])), 'manual commission bill appears as pending payable commission');
	});
