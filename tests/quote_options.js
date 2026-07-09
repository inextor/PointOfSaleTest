async function ensureUserProductionArea(session) {
	if (session.user.production_area_id) {
		return Number(session.user.production_area_id);
	}

	const storeId = Number(session.user.store_id || testConfig.storeId);
	const area = await apiRequest('/production_area.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('Production Area Quote Options Test'),
			status: 'ACTIVE',
			store_id: storeId
		}
	});

	if (!area.id) {
		throw new Error('Production area creation did not return an id: ' + JSON.stringify(area));
	}

	await apiRequest('/user.php', {
		method: 'PUT',
		bearer: session.bearer,
		body: {
			id: session.user.id,
			production_area_id: area.id
		}
	});

	session.user.production_area_id = area.id;
	return Number(area.id);
}

async function createQuoteOptionItem(bearer, index) {
	const response = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
		body: {
			item: {
				applicable_tax: 'DEFAULT',
				availability_type: 'ON_STOCK',
				clave_sat: '53111603',
				currency_id: 'MXN',
				name: uniqueName('Quote Option Stock ' + index),
				note_required: 'NO',
				on_sale: 'NO',
				reference_price: 0,
				status: 'ACTIVE',
				unidad_medida_sat_id: 'H87'
			}
		}
	});

	if (!response.item || !response.item.id) {
		throw new Error('Option item creation did not return item.id: ' + JSON.stringify(response));
	}

	return response.item;
}

async function createQuoteOptionsParent(bearer, optionItems) {
	const response = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
		body: {
			item: {
				applicable_tax: 'DEFAULT',
				availability_type: 'ALWAYS',
				clave_sat: '53111603',
				currency_id: 'MXN',
				name: uniqueName('Quote Parent With Stock Options'),
				note_required: 'NO',
				on_sale: 'YES',
				reference_price: 0,
				status: 'ACTIVE',
				unidad_medida_sat_id: 'H87'
			},
			options: [
				{
					item_option: {
						included_extra_qty: 4,
						included_options: 4,
						max_extra_qty: 4,
						max_options: 4,
						min_options: 1,
						min_selections: 1,
						name: 'Stock Options',
						status: 'ACTIVE'
					},
					values: optionItems.map(item => ({
						item_option_value: {
							charge_type: 'OPTIONAL',
							extra_price: 0,
							item_id: item.id,
							max_extra_qty: 1,
							portion_amount: 1,
							price: 0,
							status: 'ACTIVE'
						}
					}))
				}
			]
		}
	});

	const option = response.options && response.options[0] && response.options[0].item_option;
	if (!response.item || !response.item.id || !option || !option.id) {
		throw new Error('Parent item creation did not return item and option ids: ' + JSON.stringify(response));
	}

	return { item: response.item, itemOption: option };
}

async function adjustQuoteOptionStock(optionItems, storeId, bearer) {
	return apiRequest('/updates/stock_adjust.php', {
		method: 'POST',
		bearer,
		body: optionItems.map(item => ({
			comment: 'Quote options integration test initial stock',
			item_id: item.id,
			qty: 1000,
			skip_merma: true,
			store_id: storeId
		}))
	});
}

async function getCurrentStock(itemId, storeId, bearer) {
	const response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer }
	);

	return response.data && response.data[0] ? response.data[0].stock_record : null;
}

async function createQuoteTestClient(storeId, bearer) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName('Quote Options Client'),
			price_type_id: 1,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Client creation did not return an id: ' + JSON.stringify(client));
	}

	return client;
}

function quoteLine(itemId, itemGroup, itemOptionId) {
	return {
		quote_item: {
			discount: 0,
			discount_percent: 0,
			item_group: itemGroup,
			item_id: itemId,
			item_option_id: itemOptionId,
			item_option_qty: itemOptionId ? 1 : 0,
			original_unitary_price: 0,
			price_multiplier: 1,
			provider_price: 0,
			qty: 1,
			status: 'ACTIVE',
			subtotal: 0,
			tax: 0,
			tax_included: 'NO',
			total: 0,
			unitary_price: 0
		}
	};
}

function orderLine(itemId, itemGroup, itemOptionId) {
	return {
		order_item: {
			commanda_status: 'NOT_DISPLAYED',
			delivery_status: 'PENDING',
			discount: 0,
			discount_percent: 0,
			has_separator: 'NO',
			is_free_of_charge: 'NO',
			is_item_extra: 'NO',
			item_group: itemGroup,
			item_id: itemId,
			item_option_id: itemOptionId,
			item_option_qty: 1,
			note: '',
			original_unitary_price: 0,
			paid_qty: 0,
			preparation_status: 'PENDING',
			qty: 1,
			return_required: 'NO',
			status: 'ACTIVE',
			stock_status: 'IN_STOCK',
			subtotal: 0,
			tax: 0,
			tax_included: 'NO',
			total: 0,
			type: 'NORMAL',
			unitary_price: 0,
			unitary_price_meta: 0
		},
		order_item_exceptions: [],
		serials: []
	};
}

async function createOptionsQuote(client, parentItem, optionItems, itemOptionId, storeId, bearer) {
	const itemGroup = Date.now();
	const validUntil = new Date();
	validUntil.setDate(validUntil.getDate() + 7);

	const quote = await apiRequest('/quote_info.php', {
		method: 'POST',
		bearer,
		body: {
			quote: {
				approved_status: 'PENDING',
				client_user_id: client.id,
				currency_id: 'MXN',
				email: '',
				name: client.name,
				note: '',
				phone: '',
				price_type_id: 1,
				store_id: storeId,
				sync_id: createAgentSyncId(client.id),
				tax_percent: 16,
				valid_until: validUntil.toISOString().slice(0, 10)
			},
			items: [
				quoteLine(parentItem.id, itemGroup, null),
				...optionItems.map(item => quoteLine(item.id, itemGroup, itemOptionId))
			]
		}
	});

	if (!quote.quote || !quote.quote.id) {
		throw new Error('Quote creation did not return quote.id: ' + JSON.stringify(quote));
	}

	return { quote, itemGroup };
}

async function convertQuoteToDeliveryOrder(quote, itemGroup, parentItem, optionItems, itemOptionId, session, storeId) {
	const deliveryDate = new Date();
	deliveryDate.setDate(deliveryDate.getDate() + 2);

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			order: {
				amount_paid: 0,
				cashier_user_id: session.user.id,
				client_name: quote.client_user.name,
				client_user_id: quote.client_user.id,
				currency_id: 'MXN',
				delivery_schedule: mysqlDate(deliveryDate),
				delivery_status: 'PENDING',
				discount: 0,
				paid_status: 'PENDING',
				price_type_id: 1,
				quote_id: quote.quote.id,
				service_type: 'QUICK_SALE',
				status: 'CLOSED',
				store_id: storeId,
				subtotal: 0,
				sync_id: createAgentSyncId(session.user.id),
				tax: 0,
				tax_percent: 16,
				total: 0
			},
			items: [
				orderLine(parentItem.id, itemGroup, null),
				...optionItems.map(item => orderLine(item.id, itemGroup, itemOptionId))
			]
		}
	});

	if (!orderInfo.order || !orderInfo.order.id) {
		throw new Error('Order creation did not return order.id: ' + JSON.stringify(orderInfo));
	}

	await apiRequest('/updates.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			method: 'closeOrder',
			order_id: orderInfo.order.id
		}
	});

	return { orderId: orderInfo.order.id, deliveryDate };
}

QUnit.module('Quote options production order');

QUnit.test('quote with stocked options creates a scheduled production order', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	const storeId = Number(session.user.store_id || testConfig.storeId);
	assert.ok(session.bearer, 'logged in');

	const productionAreaId = await ensureUserProductionArea(session);
	assert.ok(productionAreaId, 'resolved production area assigned to login user');

	const optionItems = [];
	for (let index = 1; index <= 4; index++) {
		optionItems.push(await createQuoteOptionItem(session.bearer, index));
	}
	assert.equal(optionItems.length, 4, 'created four stock-controlled option items');

	await adjustQuoteOptionStock(optionItems, storeId, session.bearer);
	for (const item of optionItems) {
		const currentStock = await getCurrentStock(item.id, storeId, session.bearer);
		assert.equal(Number(currentStock && currentStock.qty), 1000, 'option item ' + item.id + ' starts with stock 1000');
	}

	const parent = await createQuoteOptionsParent(session.bearer, optionItems);
	assert.equal(parent.item.availability_type, 'ALWAYS', 'parent can be sold without stock');
	assert.equal(parent.item.on_sale, 'YES', 'parent is sellable');

	const parentStockBeforeSale = await getCurrentStock(parent.item.id, storeId, session.bearer);
	assert.notOk(parentStockBeforeSale, 'parent has no initial stock record');

	const areaItem = await apiRequest('/production_area_item.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			item_id: parent.item.id,
			production_area_id: productionAreaId,
			status: 'ACTIVE'
		}
	});
	assert.equal(Number(areaItem.production_area_id), productionAreaId, 'parent assigned to login user production area');

	const client = await createQuoteTestClient(storeId, session.bearer);
	assert.ok(client.id, 'created quote client');

	const quoteFixture = await createOptionsQuote(
		client,
		parent.item,
		optionItems,
		parent.itemOption.id,
		storeId,
		session.bearer
	);
	assert.ok(quoteFixture.quote.quote.id, 'created quote with parent and selected options');

	const converted = await convertQuoteToDeliveryOrder(
		quoteFixture.quote,
		quoteFixture.itemGroup,
		parent.item,
		optionItems,
		parent.itemOption.id,
		session,
		storeId
	);
	assert.ok(converted.orderId, 'converted quote to order');

	const reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(converted.orderId), {
		bearer: session.bearer
	});
	assert.equal(reloadedOrder.order.status, 'CLOSED', 'order is closed');
	assert.equal(Number(reloadedOrder.order.quote_id), Number(quoteFixture.quote.quote.id), 'order remains linked to quote');
	assert.ok(reloadedOrder.order.delivery_schedule, 'order retains its delivery date');

	const reloadedQuote = await apiRequest('/quote_info.php?id=' + encodeURIComponent(quoteFixture.quote.quote.id), {
		bearer: session.bearer
	});
	assert.equal(reloadedQuote.quote.approved_status, 'APPROVED', 'quote was approved by order conversion');
	assert.equal(Number(reloadedQuote.order.id), Number(converted.orderId), 'quote exposes its generated order');

	const parentOrderItem = reloadedOrder.items.find(row => Number(row.order_item.item_id) === Number(parent.item.id));
	const optionOrderItems = reloadedOrder.items.filter(row =>
		optionItems.some(item => Number(item.id) === Number(row.order_item.item_id))
	);
	assert.ok(parentOrderItem, 'order contains parent item');
	assert.equal(optionOrderItems.length, 4, 'order contains all four option items');
	assert.ok(optionOrderItems.every(row =>
		Number(row.order_item.item_option_id) === Number(parent.itemOption.id)
	), 'option items retain item_option_id');
	assert.ok(optionOrderItems.every(row =>
		String(row.order_item.item_group) === String(parentOrderItem.order_item.item_group)
	), 'parent and options retain the shared item_group');

	for (const item of optionItems) {
		const currentStock = await getCurrentStock(item.id, storeId, session.bearer);
		assert.equal(Number(currentStock && currentStock.qty), 999, 'option item ' + item.id + ' stock decreases to 999');
	}

	const reportStart = new Date();
	reportStart.setDate(reportStart.getDate() - 1);
	const reportEnd = new Date();
	reportEnd.setDate(reportEnd.getDate() + 7);
	const productionOrderItems = await apiRequest(
		'/reports/getProductionOrderItems.php?start_timestamp=' + encodeURIComponent(mysqlDate(reportStart))
		+ '&end_timestamp=' + encodeURIComponent(mysqlDate(reportEnd)),
		{ bearer: session.bearer }
	);

	assert.ok(productionOrderItems.some(row =>
		Number(row.id) === Number(parentOrderItem.order_item.id)
	), 'production report includes the parent order item');
	assert.notOk(productionOrderItems.some(row =>
		optionItems.some(item => Number(item.id) === Number(row.item_id))
	), 'production report does not list option children independently');
});
