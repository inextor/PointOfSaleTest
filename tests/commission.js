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

function findTestCommissionRule(order, rules, item, orderItem) {
	item = item || {};
	orderItem = orderItem || {};

	const candidates = (rules || []).filter((rule) => {
		if (rule.status !== 'ACTIVE') return false;
		if (rule.store_id != null && Number(rule.store_id) !== Number(order.store_id)) return false;
		if (rule.price_type_id != null && Number(rule.price_type_id) !== Number(order.price_type_id)) return false;
		if (rule.category_id != null && item.category_id != null && Number(rule.category_id) !== Number(item.category_id)) return false;
		if (rule.item_id != null && orderItem.item_id != null && Number(rule.item_id) !== Number(orderItem.item_id)) return false;
		return true;
	});

	candidates.sort((a, b) => {
		const scoreA = (a.item_id != null ? 1 : 0) + (a.category_id != null ? 1 : 0) + ((a.store_id != null || a.price_type_id != null) ? 1 : 0);
		const scoreB = (b.item_id != null ? 1 : 0) + (b.category_id != null ? 1 : 0) + ((b.store_id != null || b.price_type_id != null) ? 1 : 0);
		if (scoreB !== scoreA) return scoreB - scoreA;
		if (b.item_id != null && a.item_id == null) return 1;
		if (a.item_id != null && b.item_id == null) return -1;
		if (b.category_id != null && a.category_id == null) return 1;
		if (a.category_id != null && b.category_id == null) return -1;
		return 0;
	});

	return candidates[0] || null;
}

function calculateTestOrderCommission(order, items, rules) {
	return items.reduce((summary, row) => {
		const rule = findTestCommissionRule(order, rules, row.item, row.order_item);
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

async function ensureCommissionRule(session, storeId, priceTypeId, basePercent, discountReductionPerPercent, categoryId, itemId) {
	const search = await apiRequest(
		'/commission_rule.php?limit=9999',
		{ bearer: session.bearer }
	);

	const existingRows = search.data || search.result || [];
	const existing = existingRows.find((rule) => {
		return (storeId != null ? Number(rule.store_id) === Number(storeId) : rule.store_id == null)
			&& (priceTypeId != null ? Number(rule.price_type_id) === Number(priceTypeId) : rule.price_type_id == null)
			&& (categoryId != null ? Number(rule.category_id) === Number(categoryId) : rule.category_id == null)
			&& (itemId != null ? Number(rule.item_id) === Number(itemId) : rule.item_id == null);
	});

	const payload = {
		base_percent: basePercent,
		discount_reduction_per_percent: discountReductionPerPercent,
		status: 'ACTIVE'
	};

	if (storeId != null) payload.store_id = storeId;
	if (priceTypeId != null) payload.price_type_id = priceTypeId;
	if (categoryId != null) payload.category_id = categoryId;
	if (itemId != null) payload.item_id = itemId;

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

	QUnit.test('rule specificity matches category and item overrides', function(assert) {
		const order = { store_id: 1, price_type_id: 1 };
		const rules = [
			{ status: 'ACTIVE', store_id: 1, price_type_id: 1, base_percent: 5, discount_reduction_per_percent: 0 },
			{ status: 'ACTIVE', store_id: 1, price_type_id: 1, category_id: 10, base_percent: 8, discount_reduction_per_percent: 0 },
			{ status: 'ACTIVE', item_id: 42, base_percent: 12, discount_reduction_per_percent: 0 }
		];

		const storeRule = findTestCommissionRule(order, rules, { category_id: 99 }, { item_id: 50 });
		assert.equal(storeRule.base_percent, 5, 'item not in category 10 or id 42 falls back to store rule');

		const categoryRule = findTestCommissionRule(order, rules, { category_id: 10 }, { item_id: 50 });
		assert.equal(categoryRule.base_percent, 8, 'item in category 10 uses category rule over store rule');

		const itemRule = findTestCommissionRule(order, rules, { category_id: 10 }, { item_id: 42 });
		assert.equal(itemRule.base_percent, 12, 'item_id match takes precedence over category match');

		const nullStoreRule = findTestCommissionRule(
			{ store_id: 1, price_type_id: 1 },
			[
				{ status: 'ACTIVE', base_percent: 3, discount_reduction_per_percent: 0 },
				{ status: 'ACTIVE', store_id: 1, price_type_id: 1, base_percent: 7, discount_reduction_per_percent: 0 }
			],
			{},
			{}
		);
		assert.equal(nullStoreRule.base_percent, 7, 'rule with store_id set beats null-only rule for same store');

		const nullOnlyRule = findTestCommissionRule(
			{ store_id: 99, price_type_id: 1 },
			[
				{ status: 'ACTIVE', base_percent: 3, discount_reduction_per_percent: 0 },
				{ status: 'ACTIVE', store_id: 1, price_type_id: 1, base_percent: 7, discount_reduction_per_percent: 0 }
			],
			{},
			{}
		);
		assert.equal(nullOnlyRule.base_percent, 3, 'null-only rule matches any store');
	});

	QUnit.test('commission rule CRUD with category and item fields', async function(assert) {
		assert.timeout(60000);
		assert.expect(8);

		const session = await login();
		assert.ok(session.bearer, 'logged in');

		const basePercent = 15 + Math.floor(Math.random() * 5);
		const uniqueCategoryId = 90000 + Math.floor(Math.random() * 10000);
		const payload = {
			store_id: 1,
			price_type_id: 1,
			category_id: uniqueCategoryId,
			base_percent: basePercent,
			discount_reduction_per_percent: 0,
			status: 'ACTIVE'
		};

		const created = await apiRequest('/commission_rule.php', {
			method: 'POST',
			bearer: session.bearer,
			body: payload
		});
		assert.ok(created.id, 'created commission rule via POST');
		const ruleId = created.id;

		const listed = await apiRequest('/commission_rule.php?limit=9999', {
			bearer: session.bearer
		});
		const listedRows = listed.data || listed.result || [];
		assert.ok(listedRows.find(r => Number(r.id) === ruleId), 'GET defaults to ACTIVE rules and includes created rule');

		const inactive = await apiRequest('/commission_rule.php?status=INACTIVE&limit=9999', {
			bearer: session.bearer
		});
		const inactiveRows = inactive.data || inactive.result || [];
		assert.ok(!inactiveRows.find(r => Number(r.id) === ruleId), 'GET with status=INACTIVE does not include active rule');

		const deleted = await apiRequest('/commission_rule.php', {
			method: 'DELETE',
			bearer: session.bearer,
			body: { id: ruleId }
		});
		assert.ok(deleted.result === 'ok', 'DELETE soft-deletes the rule');

		const listedAfter = await apiRequest('/commission_rule.php?limit=9999', {
			bearer: session.bearer
		});
		const listedAfterRows = listedAfter.data || listedAfter.result || [];
		assert.ok(!listedAfterRows.find(r => Number(r.id) === ruleId), 'soft-deleted rule no longer appears in default GET');

		const inactiveAfter = await apiRequest('/commission_rule.php?status=INACTIVE&limit=9999', {
			bearer: session.bearer
		});
		const inactiveAfterRows = inactiveAfter.data || inactiveAfter.result || [];
		assert.ok(inactiveAfterRows.find(r => Number(r.id) === ruleId), 'soft-deleted rule appears when status=INACTIVE is requested');

		try {
			await apiRequest('/commission_rule.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { base_percent: 10 }
			});
			assert.ok(false, 'POST without any matching field should fail');
		} catch (error) {
			assert.ok(true, 'POST without any matching field returns error');
		}
	});

	QUnit.test('agent fallback uses cashier when client has no agent', async function(assert) {
		assert.timeout(60000);
		assert.expect(5);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const priceTypeId = 1;

		assert.ok(session.bearer, 'logged in');

		await ensureCommissionRule(session, storeId, priceTypeId, 5, 0);
		assert.ok(true, 'created commission rule for store');

		const amountItem = await createCommissionTestItem(session, 'AMOUNT', 10);

		const orderItems = [
			commissionOrderItem(amountItem, 2, 100, 200)
		];

		const startedAt = new Date(Date.now() - 2000);
		const orderPayload = commissionOrderPayload(session, { id: null, name: '' }, storeId, priceTypeId, orderItems);

		const orderInfo = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: orderPayload
		});
		assert.ok(orderInfo.order && orderInfo.order.id, 'created order without client');
		const orderId = orderInfo.order.id;

		const paymentInfo = await apiRequest('/payment_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: paymentPayload(orderId, orderInfo.order.total, session.user.id)
		});
		const paymentId = paymentInfo.payment && paymentInfo.payment.id;
		assert.ok(paymentId, 'paid order');

		const endedAt = new Date(Date.now() + 2000);
		const date_start = mysqlDate(startedAt);
		const date_end = mysqlDate(endedAt);

		const summaryReport = await apiRequest(
			'/reports/getCommissionSummaryByAgent.php?date_start=' + encodeURIComponent(date_start)
			+ '&date_end=' + encodeURIComponent(date_end)
			+ '&order_id=' + encodeURIComponent(orderId),
			{ bearer: session.bearer }
		);
		const agentRow = summaryReport.find(row => Number(row.agent_id) === Number(session.user.id));
		assert.ok(agentRow, 'order without client still appears in commission report under cashier as agent');
		assertMoneyEqual(assert, agentRow.total_commission, 20, 'commission amount matches cashier fallback');
	});

	QUnit.test('per-item commission_generation created on generate_commission_bills', async function(assert) {
		assert.timeout(60000);
		assert.expect(6);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const priceTypeId = 1;

		assert.ok(session.bearer, 'logged in');

		const amountItem = await createCommissionTestItem(session, 'AMOUNT', 10);
		const percentItem = await createCommissionTestItem(session, 'PERCENT', 5);

		const orderItems = [
			commissionOrderItem(amountItem, 2, 100, 200),
			commissionOrderItem(percentItem, 1, 200, 200)
		];

		const orderInfo = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: commissionOrderPayload(session, { id: null, name: '' }, storeId, priceTypeId, orderItems)
		});
		assert.ok(orderInfo.order && orderInfo.order.id, 'created order with two item types');
		const orderId = orderInfo.order.id;

		const paymentInfo = await apiRequest('/payment_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: paymentPayload(orderId, orderInfo.order.total, session.user.id)
		});
		const paymentId = paymentInfo.payment && paymentInfo.payment.id;
		assert.ok(paymentId, 'paid order');

		const generated = await apiRequest('/generate_commission_bills.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				selections: [{ order_id: orderId, payment_id: paymentId }]
			}
		});
		assert.equal(generated.status, 'success', 'commission generation succeeded');
		assert.ok(generated.generated_commission_ids.length >= 1, 'commission rows created');

		const itemsReport = await apiRequest('/reports/getCommissionItemsByOrder.php?order_id=' + encodeURIComponent(orderId), {
			bearer: session.bearer
		});
		assert.equal(itemsReport.length, 2, 'item report returns both lines');
		const totalCommission = itemsReport.reduce((sum, row) => sum + Number(row.commission || 0), 0);
		assertMoneyEqual(assert, totalCommission, 30, 'per-item commissions sum to expected total (20 from amount + 10 from percent)');
	});
