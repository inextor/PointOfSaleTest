async function grantConsignmentDeliveredPermission(userId) {
	const adminSession = await login('nextor@gmail.com', 'sdfgsdfggggggg');
	return apiRequest('/user_permission.php', {
		method: 'PUT',
		bearer: adminSession.bearer,
		body: {
			user_id: userId,
			add_consignment_delivered: true
		}
	});
}

async function findOrCreateItem(bearer) {
	const found = await apiRequest('/item_info.php?name=' + encodeURIComponent(testConfig.itemName), { bearer });
	const existing = found.data && found.data.find((row) => row.item && row.item.name === testConfig.itemName);

	if (existing) {
		return existing.item.id;
	}

	const created = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
		body: {
			item: {
				applicable_tax: 'DEFAULT',
				availability_type: 'ON_STOCK',
				clave_sat: '53111603',
				currency_id: 'MXN',
				name: testConfig.itemName,
				note_required: 'NO',
				on_sale: 'YES',
				reference_price: 0,
				status: 'ACTIVE',
				unidad_medida_sat_id: 'H87'
			}
		}
	});

	if (!created.item || !created.item.id) {
		throw new Error('Item creation response did not include item.id: ' + JSON.stringify(created));
	}

	return created.item.id;
}

async function adjustStock(itemId, bearer) {
	return apiRequest('/updates.php', {
		method: 'POST',
		bearer,
		body: {
			method: 'adjustStock',
			stock_records: [
				{ store_id: testConfig.storeId, qty: 20, item_id: itemId }
			]
		}
	});
}

async function createDeliveredConsignment(itemId, sellerUserId, bearer) {
	const data = await apiRequest('/consignment_delivered_info.php', {
		method: 'POST',
		bearer,
		body: {
			consignment_delivered: {
				seller_user_id: sellerUserId,
				store_id: testConfig.storeId
			},
			items: [
				{
					consignment_delivered_item: {
						item_id: itemId,
						qty: testConfig.deliveredQty,
						unitary_price: testConfig.unitaryPrice
					}
				}
			]
		}
	});

	const consignmentId = data.consignment_delivered && data.consignment_delivered.id;
	const consignmentItemId = data.items && data.items[0] && data.items[0].consignment_delivered_item.id;

	if (!consignmentId || !consignmentItemId) {
		throw new Error('Consignment creation response did not include expected ids: ' + JSON.stringify(data));
	}

	return { consignmentId, consignmentItemId };
}

async function settleDeliveredConsignment(consignmentId, consignmentItemId, bearer) {
	return apiRequest('/updates/consignment_delivered_settle.php', {
		method: 'POST',
		bearer,
		body: {
			consignment_delivered_id: consignmentId,
			return_items: [
				{
					id: consignmentItemId,
					returned_qty: testConfig.returnedQty,
					sold_qty: testConfig.soldQty
				}
			]
		}
	});
}

async function getGeneratedOrders(consignmentId, bearer) {
	return apiRequest('/order_info.php?consignment_delivered_id=' + consignmentId, { bearer });
}

QUnit.module('Delivered Consignment');

QUnit.test('settlement creates linked sale order', async function(assert) {
	assert.timeout(30000);
	assert.expect(11);

	const session = await login();
	const bearer = session.bearer;
	const user = session.user;
	assert.ok(bearer, 'logged in as nextor');
	assert.ok(user.id, 'loaded current user from login response');

	const permResult = await grantConsignmentDeliveredPermission(user.id);
	assert.ok(permResult, 'granted add_consignment_delivered permission');

	const itemId = await findOrCreateItem(bearer);
	assert.ok(itemId, 'found or created item "consigna delivered"');

	const stockResponse = await adjustStock(itemId, bearer);
	assert.ok(stockResponse, 'adjusted item stock');

	const ids = await createDeliveredConsignment(itemId, user.id, bearer);
	assert.ok(ids.consignmentId, 'created delivered consignment');
	assert.ok(ids.consignmentItemId, 'created delivered consignment item');

	const settled = await settleDeliveredConsignment(ids.consignmentId, ids.consignmentItemId, bearer);
	const settledStatus = settled.status || (settled.consignment_delivered && settled.consignment_delivered.status);
	assert.equal(settledStatus, 'SETTLED', 'settled delivered consignment');

	const orders = await getGeneratedOrders(ids.consignmentId, bearer);
	assert.equal(orders.data.length, 1, 'one sale order was generated');

	const order = orders.data[0].order || orders.data[0];
	assert.equal(Number(order.consignment_delivered_id), Number(ids.consignmentId), 'sale order is linked to delivered consignment');
	assert.equal(Number(order.total), testConfig.soldQty * testConfig.unitaryPrice, 'sale order total matches sold quantity');
});

QUnit.test('recreated backend sell simple flow', async function(assert) {
	assert.timeout(30000);
	assert.expect(5);

	const session = await login();
	assert.ok(session.bearer, 'Login');

	const itemIds = await createBackendSaleItems(session.bearer);
	assert.equal(itemIds.length, 7, 'Items creados');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: backendSaleOrderPayload(itemIds, session.user.id)
	});

	assert.ok(orderInfo.order && orderInfo.order.id, 'Orden creada');

	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: paymentPayload(orderInfo.order.id, orderInfo.order.total, session.user.id)
	});

	const paidOrderId = paymentInfo.movements[0].bank_movement_orders[0].order_id;
	assert.equal(Number(paidOrderId), Number(orderInfo.order.id), 'Pago realizado');

	const reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(paidOrderId), { bearer: session.bearer });
	assert.equal(reloadedOrder.order.paid_status, 'PAID', 'Orden pagada');
});
