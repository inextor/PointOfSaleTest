QUnit.config.autostart = false;

document.getElementById('endpoint').value = window.location.protocol + '//' + window.location.host + '/PointOfSale';

const testConfig = {
	itemName: 'consigna delivered',
	storeId: 1,
	deliveredQty: 3,
	soldQty: 2,
	returnedQty: 1,
	unitaryPrice: 25
};

function endpoint() {
	//return 'https://test.integranet.xyz/api/'
	return document.getElementById('endpoint').value.replace(/\/$/, '');
}

function valueOrFallback(value, fallback) {
	return value === null || value === undefined || value === '' ? fallback : value;
}

function createAgentSyncId(agentId) {
	const resolvedAgentId = valueOrFallback(agentId, '0');

	return resolvedAgentId + '-' + Date.now();
}

function createSyncUuid() {
	if (window.crypto && typeof window.crypto.randomUUID === 'function') {
		return window.crypto.randomUUID();
	}

	return null;
}

function createPaymentSyncIdentifier(agentId) {
	const syncUuid = createSyncUuid();

	// Use sync_uuid when the browser can create a real UUID; otherwise send only the legacy sync_id fallback.
	return syncUuid ? { sync_uuid: syncUuid } : { sync_id: createAgentSyncId(agentId) };
}

function getPaymentComplementResult(response) {
	return response && response.GeneraCFDIV40CPagosResult ? response.GeneraCFDIV40CPagosResult : {};
}

async function apiRequest(path, options) {
	options = options || {};
	const headers = {
		accept: 'application/json, text/plain, */*'
	};

	if (options.body !== undefined) {
		headers['content-type'] = 'application/json';
	}

	if (options.bearer) {
		headers.Authorization = 'Bearer ' + options.bearer;
	}

	const response = await fetch(endpoint() + path, {
		method: options.method || 'GET',
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		mode: 'cors',
		credentials: 'omit'
	});

	const text = await response.text();
	let data = {};

	if (text.trim() !== '') {
		data = JSON.parse(text);
	}

	if (!response.ok) {
		const error = new Error((options.method || 'GET') + ' ' + path + ' failed with HTTP ' + response.status);
		error.response = data;
		throw error;
	}

	return data;
}

async function login() {
	const data = await apiRequest('/login.php', {
		method: 'POST',
		body: {
			username: document.getElementById('username').value,
			password: document.getElementById('password').value
		}
	});

	if (!data.session || !data.session.id) {
		throw new Error('Login response did not include session.id: ' + JSON.stringify(data));
	}

	if (!data.user || !data.user.id) {
		throw new Error('Login response did not include user.id: ' + JSON.stringify(data));
	}

	return { bearer: data.session.id, user: data.user };
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

function uniqueName(prefix) {
	return prefix + ' ' + Date.now() + ' ' + Math.floor(Math.random() * 100000);
}

async function createSaleTestItem(bearer, availabilityType, stockQty) {
	const data = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
		body: {
			item: {
				availability_type: availabilityType,
				clave_sat: '53111603',
				name: uniqueName('Item Test'),
				note_required: 'NO',
				on_sale: 'NO',
				reference_price: 0,
				status: 'ACTIVE',
				unidad_medida_sat_id: 'H87'
			}
		}
	});

	if (!data.item || !data.item.id) {
		throw new Error('Sale test item creation response did not include item.id: ' + JSON.stringify(data));
	}

	if (availabilityType === 'ON_STOCK') {
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer,
			body: {
				method: 'adjustStock',
				stock_records: [
					{ store_id: testConfig.storeId, qty: stockQty, item_id: data.item.id }
				]
			}
		});
	}

	return data.item.id;
}

async function createBackendSaleItems(bearer) {
	const itemIds = [];

	for (let i = 0; i < 6; i++) {
		itemIds.push(await createSaleTestItem(bearer, 'ALWAYS'));
	}

	itemIds.push(await createSaleTestItem(bearer, 'ON_STOCK', 200));

	return itemIds;
}

function backendSaleOrderPayload(itemIds, userId) {
	const syncId = createAgentSyncId(userId);
	const order = {
		order: {
			billing_data_id: 1,
			cashier_user_id: 1,
			client_name: 'PUBLICO GRAL',
			currency_id: 'MXN',
			marked_for_billing: null,
			note: null,
			paid_status: null,
			paid_timetamp: null,
			price_type_id: 1,
			service_type: 'QUICK_SALE',
			status: 'PENDING',
			store_id: testConfig.storeId,
			sync_id: syncId,
			subtotal: 0,
			tax: 0,
			tax_percent: 8,
			total: 0,
			discount: 0
		},
		items: []
	};

	const rows = [
		{ qty: 3, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 7, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 9, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 11, unitaryPrice: 14.3518182, taxIncluded: 'YES' },
		{ qty: 17, unitaryPrice: 14.3517647, taxIncluded: 'YES' },
		{ qty: 19, unitaryPrice: 15.5, taxIncluded: 'YES' },
		{ qty: 23, unitaryPrice: 14.3517391, taxIncluded: 'YES' }
	];

	order.items = rows.map((row, index) => {
		const subtotal = Number((row.qty * row.unitaryPrice).toFixed(2));
		const tax = row.taxIncluded === 'YES' ? 0 : Number((subtotal * 0.08).toFixed(2));

		return {
			order_item: {
				item_id: itemIds[index],
				delivery_status: 'PENDING',
				stock_status: 'IN_STOCK',
				tax_included: row.taxIncluded,
				delivered_qty: 0,
				status: 'ACTIVE',
				commanda_status: 'NOT_DISPLAYED',
				item_group: Date.now() + index,
				return_required: 'NO',
				is_item_extra: 'NO',
				is_free_of_charge: 'NO',
				note: '',
				qty: row.qty,
				item_option_qty: 1,
				paid_qty: 0,
				original_unitary_price: 15.5,
				unitary_price: row.unitaryPrice,
				subtotal,
				discount: 0,
				discount_percent: 0,
				tax,
				total: Number((subtotal + tax).toFixed(2)),
				preparation_status: 'PENDING'
			}
		};
	});

	return order;
}

function paymentPayload(orderId, total, userId) {
	const syncIdentifier = createPaymentSyncIdentifier(userId);

	return {
		movements: [
			{
				bank_movement: {
					transaction_type: 'CASH',
					client_user_id: null,
					total,
					amount_received: total,
					currency_id: 'MXN',
					exchange_rate: 1,
					type: 'income'
				},
				bank_movement_orders: [
					{
						currency_amount: total,
						amount: total,
						currency_id: 'MXN',
						exchange_rate: 1,
						order_id: orderId
					}
				]
			}
		],
		payment: {
			type: 'income',
			tag: 'SALE',
			payment_amount: total,
			received_amount: total,
			change_amount: 0,
			currency_id: 'MXN',
			...syncIdentifier
		}
	};
}

const facturaCreditTestConfig = {
	storeId: 1,
	billingDataId: 1,
	priceTypeId: 1,
	price: 116,
	qty: 1,
	stockQty: 5,
	taxPercent: 16,
	itemName: 'Test agent factura name',
	batch: 'BATCH-' + Date.now(),
	expirationDate: '2030-12-31',
	receiver: {
		razonSocial: 'COPPEL',
		email: 'integranet@integranet.xyz',
		rfc: 'COP920428Q20',
		domicilioFiscal: '80105',
		regimenFiscal: '601',
		regimenCapital: '601',
		usoCfdi: 'G03'
	},
	serie: 'A'
};

function taxSplitFromTaxIncluded(total, taxPercent) {
	const subtotal = Number((total / (1 + (taxPercent / 100))).toFixed(2));
	const tax = Number((total - subtotal).toFixed(2));
	return { subtotal, tax };
}

async function createCreditClient(bearer) {
	const timestamp = Date.now();
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			name: 'test ' + timestamp,
			credit_days: 30,
			credit_limit: 30000,
			payment_option: 'STORE',
			price_type_id: facturaCreditTestConfig.priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT',
			username: 'test-agent-factura-' + timestamp
		}
	});

	if (!client.id) {
		throw new Error('Client creation response did not include id: ' + JSON.stringify(client));
	}

	return client;
}

async function createBatchFacturaItem(bearer) {
	const item = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
			body: {
				item: {
					applicable_tax: 'PERCENT',
					availability_type: 'ON_STOCK',
					batch_option: 'BATCH_AND_EXPIRATION',
					clave_sat: '53111603',
				currency_id: 'MXN',
				name: facturaCreditTestConfig.itemName + ' ' + Date.now(),
				note_required: 'NO',
					on_sale: 'YES',
					reference_price: facturaCreditTestConfig.price,
					status: 'ACTIVE',
					tax_percent: facturaCreditTestConfig.taxPercent,
					unidad_medida_sat_id: 'H87'
				}
			}
	});

	if (!item.item || !item.item.id) {
		throw new Error('Item creation response did not include item.id: ' + JSON.stringify(item));
	}

	return item.item;
}

async function addItemPrice(itemId, store, bearer) {
	const price = await apiRequest('/price.php', {
		method: 'POST',
		bearer,
		body: {
			currency_id: store.default_currency_id || 'MXN',
			item_id: itemId,
			percent: 0,
			price: facturaCreditTestConfig.price,
			price_list_id: store.price_list_id || 1,
			price_type_id: facturaCreditTestConfig.priceTypeId,
			tax_included: 'YES'
		}
	});

	if (!price.id) {
		throw new Error('Price creation response did not include id: ' + JSON.stringify(price));
	}

	return price;
}

async function addBatchStock(itemId, bearer) {
	const response = await apiRequest('/updates/stock_add.php', {
		method: 'POST',
		bearer,
		body: {
			item_id: itemId,
			store_id: facturaCreditTestConfig.storeId,
			qty: facturaCreditTestConfig.stockQty,
			comment: 'Test agent factura batch stock',
			batch: facturaCreditTestConfig.batch,
			expiration_date: facturaCreditTestConfig.expirationDate
		}
	});

	if (!response || !response.length) {
		throw new Error('Batch stock response did not include records: ' + JSON.stringify(response));
	}

	return response;
}

function creditOrderPayload(item, client, store, sessionUser) {
	const taxPercent = facturaCreditTestConfig.taxPercent;
	const total = facturaCreditTestConfig.price * facturaCreditTestConfig.qty;
	const split = taxSplitFromTaxIncluded(total, taxPercent);
	const syncId = createAgentSyncId(sessionUser && sessionUser.id);

	return {
		order: {
			amount_paid: 0,
			billing_data_id: facturaCreditTestConfig.billingDataId,
			cashier_user_id: sessionUser.id,
			client_name: client.name,
			client_user_id: client.id,
			currency_id: store.default_currency_id || 'MXN',
			discount: 0,
			discount_calculated: 0,
			facturado: 'NO',
			paid_status: 'PENDING',
			price_type_id: facturaCreditTestConfig.priceTypeId,
			sat_codigo_postal: facturaCreditTestConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: facturaCreditTestConfig.receiver.domicilioFiscal,
			sat_forma_pago: '99',
			sat_ieps: 0,
			sat_isr: 0,
			sat_razon_social: facturaCreditTestConfig.receiver.razonSocial,
			sat_receptor_email: facturaCreditTestConfig.receiver.email,
			sat_receptor_rfc: facturaCreditTestConfig.receiver.rfc,
			sat_regimen_capital_receptor: facturaCreditTestConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: facturaCreditTestConfig.receiver.regimenFiscal,
			sat_serie: facturaCreditTestConfig.serie,
			sat_uso_cfdi: facturaCreditTestConfig.receiver.usoCfdi,
			service_type: 'QUICK_SALE',
			status: 'PENDING',
			store_id: facturaCreditTestConfig.storeId,
			subtotal: split.subtotal,
			sync_id: syncId,
			tax: split.tax,
			tax_percent: taxPercent,
			total
		},
		items: [
			{
				order_item: {
					item_id: item.id,
					delivery_status: 'PENDING',
					stock_status: 'IN_STOCK',
					tax_included: 'YES',
					delivered_qty: 0,
					status: 'ACTIVE',
					commanda_status: 'NOT_DISPLAYED',
					item_group: Date.now(),
					return_required: 'NO',
					is_item_extra: 'NO',
					is_free_of_charge: 'NO',
					note: '',
					qty: facturaCreditTestConfig.qty,
					item_option_qty: 1,
					paid_qty: 0,
					original_unitary_price: facturaCreditTestConfig.price,
					unitary_price: split.subtotal,
					unitary_price_meta: facturaCreditTestConfig.price,
					subtotal: split.subtotal,
					discount: 0,
					discount_percent: 0,
					tax: split.tax,
					total,
					type: 'NORMAL',
					preparation_status: 'PENDING'
				},
				batches: [
					{
						batch: facturaCreditTestConfig.batch,
						expiration_date: facturaCreditTestConfig.expirationDate,
						qty: facturaCreditTestConfig.qty
					}
				]
			}
		]
	};
}

function facturaRequestPayload(order) {
	return {
		facturacion_code: order.facturacion_code,
		razon_social: facturaCreditTestConfig.receiver.razonSocial,
		email: facturaCreditTestConfig.receiver.email,
		rfc: facturaCreditTestConfig.receiver.rfc,
		domicilio_fiscal: facturaCreditTestConfig.receiver.domicilioFiscal,
		forma_de_pago: '99',
		sat_serie: facturaCreditTestConfig.serie,
		regimen_fiscal: facturaCreditTestConfig.receiver.regimenFiscal,
		regimen_capital: facturaCreditTestConfig.receiver.regimenCapital,
		uso_cfdi: facturaCreditTestConfig.receiver.usoCfdi,
		version: '4.0',
		billing_data_id: facturaCreditTestConfig.billingDataId,
		apply_rounding_discount_adjustment: false
	};
}

async function updateOrderFacturaData(order, bearer) {
	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer,
		body: {
			id: order.id,
			billing_data_id: facturaCreditTestConfig.billingDataId,
			sat_codigo_postal: facturaCreditTestConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: facturaCreditTestConfig.receiver.domicilioFiscal,
			sat_forma_pago: '99',
			sat_razon_social: facturaCreditTestConfig.receiver.razonSocial,
			sat_receptor_email: facturaCreditTestConfig.receiver.email,
			sat_receptor_rfc: facturaCreditTestConfig.receiver.rfc,
			sat_regimen_capital_receptor: facturaCreditTestConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: facturaCreditTestConfig.receiver.regimenFiscal,
			sat_serie: facturaCreditTestConfig.serie,
			sat_uso_cfdi: facturaCreditTestConfig.receiver.usoCfdi
		}
	});

	return apiRequest('/order_info.php?id=' + encodeURIComponent(order.id), { bearer });
}

function creditPaymentPayload(order, client, sessionUser) {
	const total = Number(order.total);
	const syncIdentifier = createPaymentSyncIdentifier(sessionUser && sessionUser.id);

	return {
		movements: [
			{
				bank_movement: {
					transaction_type: 'CASH',
					client_user_id: client.id,
					total,
					amount_received: total,
					currency_id: order.currency_id || 'MXN',
					exchange_rate: 1,
					status: 'ACTIVE',
					type: 'income'
				},
				bank_movement_orders: [
					{
						currency_amount: total,
						amount: total,
						currency_id: order.currency_id || 'MXN',
						exchange_rate: 1,
						status: 'ACTIVE',
						order_id: order.id
					}
				]
			}
		],
		payment: {
			type: 'income',
			tag: 'PAYMENT',
			payment_amount: total,
			received_amount: total,
			change_amount: 0,
			currency_id: order.currency_id || 'MXN',
			facturado: 'NO',
			...syncIdentifier
		}
	};
}

QUnit.module('Delivered Consignment');

QUnit.test('settlement creates linked sale order', async function(assert) {
	assert.timeout(30000);
	assert.expect(10);

	const session = await login();
	const bearer = session.bearer;
	const user = session.user;
	assert.ok(bearer, 'logged in as nextor');
	assert.ok(user.id, 'loaded current user from login response');

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

QUnit.module('Agente in Factura');

QUnit.test('credit CFDI 99 with batch item and payment complement', async function(assert) {
	assert.timeout(120000);
	assert.expect(13);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const store = await apiRequest('/store.php?id=' + facturaCreditTestConfig.storeId, { bearer: session.bearer });
	assert.ok(store.id, 'loaded test store');

	const client = await createCreditClient(session.bearer);
	assert.equal(Number(client.credit_limit), 30000, 'created credit client with 30000 limit');

	const item = await createBatchFacturaItem(session.bearer);
	assert.ok(item.id, 'created batch and expiration item');

	const price = await addItemPrice(item.id, store, session.bearer);
	assert.equal(Number(price.price), facturaCreditTestConfig.price, 'created item price for sale');

	const stock = await addBatchStock(item.id, session.bearer);
	assert.ok(stock[0].id || stock[0].stock_record_id, 'added batch and expiration stock');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: creditOrderPayload(item, client, store, session.user)
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'created credit order');

	const updatedOrderInfo = await updateOrderFacturaData(orderInfo.order, session.bearer);
	const orderToFactura = updatedOrderInfo.order || updatedOrderInfo;
	assert.equal(orderToFactura.sat_serie, facturaCreditTestConfig.serie, 'saved factura serie A on order');

	const facturada = await apiRequest('/facturacion_request.php', {
		method: 'POST',
		bearer: session.bearer,
		body: facturaRequestPayload(orderToFactura)
	});
	const facturadaOrder = facturada.order || facturada;
	assert.equal(facturadaOrder.sat_forma_pago, '99', 'generated CFDI with forma de pago 99');
	assert.ok(facturadaOrder.sat_factura_id, 'original CFDI saved on order');

	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: creditPaymentPayload(facturadaOrder, client, session.user)
	});
	assert.ok(paymentInfo.payment && paymentInfo.payment.id, 'created payment for credit order');

	const complemento = await apiRequest('/updates/facturar_pago.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			payment_id: paymentInfo.payment.id,
			transaccion: 'CP-' + paymentInfo.payment.id + '-' + Date.now()
		}
	});

	const complementoResult = getPaymentComplementResult(complemento);
	const complementoError = 'CodigoError: ' + (complementoResult.CodigoError || '') + ', ErrorCFDI: ' + (complementoResult.ErrorCFDI || '') + ', response: ' + JSON.stringify(complemento);
	assert.equal(complementoResult.CFDICorrecto, 'true', 'generated payment complement: ' + complementoError);
	assert.ok(complementoResult.UUID, 'payment complement response includes UUID');
	assert.equal(complementoResult.Serie, facturaCreditTestConfig.serie, 'payment complement uses serie A');
});

QUnit.start();
