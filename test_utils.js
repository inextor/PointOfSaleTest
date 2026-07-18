var testConfig = {
	itemName: 'consigna delivered',
	storeId: 1,
	deliveredQty: 3,
	soldQty: 2,
	returnedQty: 1,
	unitaryPrice: 25
};

var timestamp_regex = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/;

function endpoint() {
	return end_point;
}

function valueOrFallback(value, fallback) {
	return value === null || value === undefined || value === '' ? fallback : value;
}

function createAgentSyncId(agentId) {
	return valueOrFallback(agentId, '0') + '-' + Date.now();
}

function createSyncUuid() {
	if (window.crypto && typeof window.crypto.randomUUID === 'function') {
		return window.crypto.randomUUID();
	}
	return null;
}

function getUUID() {
	if (window.crypto && typeof window.crypto.randomUUID === 'function') {
		return window.crypto.randomUUID();
	}
	var buf = new Uint8Array(16);
	if (window.crypto && window.crypto.getRandomValues) {
		window.crypto.getRandomValues(buf);
	} else {
		for (var i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
	}
	buf[6] = (buf[6] & 0x0f) | 0x40;
	buf[8] = (buf[8] & 0x3f) | 0x80;
	var hex = [];
	for (var i = 0; i < 16; i++) hex.push((buf[i] < 16 ? '0' : '') + buf[i].toString(16));
	return hex[0]+hex[1]+hex[2]+hex[3]+'-'+hex[4]+hex[5]+'-'+hex[6]+hex[7]+'-'+hex[8]+hex[9]+'-'+hex[10]+hex[11]+hex[12]+hex[13]+hex[14]+hex[15];
}

function createPaymentSyncIdentifier(agentId) {
	var syncUuid = createSyncUuid();
	return syncUuid ? { sync_uuid: syncUuid } : { sync_id: createAgentSyncId(agentId) };
}

function uniqueName(prefix) {
	return prefix + ' ' + Date.now() + ' ' + Math.floor(Math.random() * 100000);
}

function mysqlDate(date) {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getRandom() {
	var d = new Date();
	return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
}

async function apiRequest(path, options) {
	options = options || {};
	var headers = {
		accept: 'application/json, text/plain, */*'
	};

	if (options.body !== undefined) {
		headers['content-type'] = 'application/json';
	}

	if (options.bearer) {
		headers.Authorization = 'Bearer ' + options.bearer;
	}

	var response = await fetch(endpoint() + path, {
		method: options.method || 'GET',
		headers: headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		mode: 'cors',
		credentials: 'include'
	});

	var text = await response.text();
	var data = {};

	if (text.trim() !== '') {
		try {
			data = JSON.parse(text);
		} catch (error) {
			throw new Error(
				(options.method || 'GET') + ' ' + path + ' returned non-JSON content: '
				+ text.trim().slice(0, 120)
			);
		}
	}

	if (!response.ok) {
		var backendMessage = data && (data.error || data.message);
		var err = new Error(
			(options.method || 'GET') + ' ' + path + ' failed with HTTP ' + response.status
			+ (backendMessage ? ': ' + backendMessage : '')
		);
		err.response = data;
		throw err;
	}

	if (options.includeStatus) {
		return { status: response.status, data: data };
	}

	return data;
}

async function login(username, password) {
	var data = await apiRequest('/login.php', {
		method: 'POST',
		body: {
			username: username || 'nextor@gmail.com',
			password: password || 'sdfgsdfggggggg'
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

function doGet(path, bearer) {
	var headers = {
		"accept": "application/json, text/plain, */*",
		"content-type": "application/json"
	};

	if (bearer) {
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(end_point + path, {
		"headers": headers,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"method": "GET",
		"mode": "cors",
		"credentials": "include"
	})
	.then(function(r) {
		if (r.status >= 200 && r.status < 300) {
			return r.json();
		} else {
			return r.json().then(function(e) { throw e; });
		}
	})
	.then(function(response) {
		return { result: response, bearer: bearer };
	});
}

function doPost(path, body, bearer) {
	var headers = {
		"accept": "application/json, text/plain, */*",
		"content-type": "application/json"
	};

	if (bearer) {
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(end_point + path, {
		"headers": headers,
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": JSON.stringify(body),
		"method": "POST",
		"mode": "cors",
		"credentials": "omit"
	})
	.then(function(r) {
		if (r.status >= 200 && r.status < 300) {
			var size = r.headers.get('content-length');
			if (size > 0)
				return r.json();
			else
				return Promise.resolve({});
		} else {
			return r.json().then(function(e) { throw e; });
		}
	})
	.then(function(response) {
		return { result: response, bearer: bearer };
	});
}

function getNewClientP(bearer) {
	var client = {
		"birthday": null,
		"created": null,
		"created_by_store_id": null,
		"created_by_user_id": 2,
		"creation_store_id": "1",
		"credit_days": 0,
		"credit_limit": 0,
		"default_billing_address_id": null,
		"default_shipping_address_id": null,
		"id": 0,
		"image_id": null,
		"lat": null,
		"lng": null,
		"name": "ClienteXXXXXXXX",
		"payment_address_id": null,
		"payment_option": "STORE",
		"platform_client_id": null,
		"points": 0,
		"preferred_store_id": null,
		"price_type_id": "1",
		"production_area_id": null,
		"status": "ACTIVE",
		"store_id": null,
		"type": "CLIENT",
		"updated": null,
		"updated_by_user_id": null,
		"workshift_id": null
	};

	return doPost('/user.php', client, bearer);
}

function getNewAdressP(client_id, bearer) {
	console.log('Creando nueva address');
	var address = {
		"name": "Carlos Collado EDITADO",
		"sat_regimen_capital": "",
		"sat_regimen_fiscal": "",
		"type": "SHIPPING",
		"address": "asdfasdf",
		"zipcode": "22800",
		"email": "",
		"rfc": "",
		"user_id": client_id,
		"lat": 31.86053689098042,
		"lng": -116.60505248383286
	};

	return doPost('/address.php', address, bearer);
}

function getItem(bearer, stock_type, qty, store_id) {
	if (stock_type === undefined)
		stock_type = 'ALWAYS';

	return doPost(
		'/item_info.php',
		{
			"item": {
				"availability_type": stock_type,
				"clave_sat": "53111603",
				"name": "Item Test " + Date.now(),
				"note_required": "NO",
				"on_sale": "NO",
				"reference_price": 0,
				"status": "ACTIVE",
				"unidad_medida_sat_id": "H87"
			}
		},
		bearer
	)
	.then(function(response) {
		if (stock_type === 'ON_STOCK' && qty !== undefined) {
			console.log('Agregando stock');
			var object = {
				"method": "adjustStock",
				"stock_records": [{
					"store_id": store_id,
					"qty": qty,
					"item_id": response.result.item.id
				}]
			};

			return doPost('/updates.php', object, bearer)
			.then(function() {
				return response.result.item.id;
			});
		}

		return response.result.item.id;
	});
}

function getItemWithCommanda(bearer, commanda_type_id) {
	return doPost(
		'/item_info.php',
		{
			"item": {
				"availability_type": 'ALWAYS',
				"clave_sat": "53111603",
				"name": "Item Test " + Date.now(),
				"note_required": "NO",
				"on_sale": "NO",
				"reference_price": 0,
				"status": "ACTIVE",
				"unidad_medida_sat_id": "H87",
				"commanda_type_id": commanda_type_id
			}
		},
		bearer
	)
	.then(function(response) {
		return response.result.item.id;
	});
}

function promiseObject(obj) {
	var keys = Object.keys(obj);
	var promises = keys.map(function(key) {
		if (obj[key] instanceof Promise)
			return obj[key];
		return Promise.resolve(obj[key]);
	});

	return Promise.all(promises).then(function(values) {
		var result = {};
		for (var i = 0; i < values.length; i++) {
			result[keys[i]] = values[i];
		}
		return result;
	});
}

function getOrderItemWithPrimes(item_ids) {
	var obj = {
		"order": {
			"billing_data_id": 1,
			"cashier_user_id": 1,
			"client_name": "PUBLICO GRAL 01:13",
			"currency_id": "MXN",
			"marked_for_billing": null,
			"note": null,
			"paid_status": null,
			"paid_timetamp": null,
			"price_type_id": 1,
			"service_type": "QUICK_SALE",
			"status": "PENDING",
			"store_id": 1,
			"sync_id": "1-" + Date.now(),
			"subtotal": 0,
			"tax": 0,
			"tax_percent": 8,
			"total": 0,
			"discount": 0
		},
		"items": []
	};

	var items = [
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973534561, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "", "qty": 3, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 46.5, "discount": 0, "tax": 3.72, "total": 50.22, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973535132, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 7, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 108.5, "discount": 0, "tax": 8.68, "total": 117.18, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973535844, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 9, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 139.5, "discount": 0, "tax": 11.16, "total": 150.66, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973536668, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 11, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 14.3518182, "subtotal": 157.87, "discount": 0, "tax": 12.63, "total": 170.5, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973537168, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "", "qty": 17, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 14.3517647, "subtotal": 243.98, "discount": 0, "tax": 19.52, "total": 263.5, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973538050, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "", "qty": 19, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 294.5, "discount": 0, "tax": 23.56, "total": 318.06, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26" } },
		{ "order_item": { "item_id": undefined, "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES", "delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973585123, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 23, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 14.3517391, "subtotal": 330.09, "discount": 0, "tax": 26.41, "total": 356.5, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26" } }
	];

	obj.items = items.map(function(item, index) {
		item.order_item.item_id = item_ids[index];
		return item;
	}).filter(function(item) {
		return item.order_item.item_id;
	});

	return obj;
}

function getPaymentSimple(order_id, total) {
	return {
		"movements": [
			{
				"bank_movement": {
					"transaction_type": "CASH",
					"client_user_id": null,
					"total": total,
					"amount_received": total,
					"currency_id": "MXN",
					"exchange_rate": 1,
					"type": "income"
				},
				"bank_movement_orders": [
					{
						"currency_amount": total,
						"amount": total,
						"currency_id": "MXN",
						"exchange_rate": 1,
						"order_id": order_id
					}
				]
			}
		],
		"payment": {
			"type": "income",
			"tag": "SALE",
			"payment_amount": total,
			"received_amount": total,
			"change_amount": 0,
			"currency_id": "MXN",
			"sync_id": "1-" + Date.now()
		}
	};
}

function paymentPayload(orderId, total, userId) {
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
		movements: [
			{
				bank_movement: {
					transaction_type: 'CASH',
					client_user_id: null,
					total: total,
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
		payment: paymentData
	};
}

function backendSaleOrderPayload(itemIds, userId) {
	var syncId = createAgentSyncId(userId);
	var order = {
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

	var rows = [
		{ qty: 3, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 7, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 9, unitaryPrice: 15.5, taxIncluded: 'NO' },
		{ qty: 11, unitaryPrice: 14.3518182, taxIncluded: 'YES' },
		{ qty: 17, unitaryPrice: 14.3517647, taxIncluded: 'YES' },
		{ qty: 19, unitaryPrice: 15.5, taxIncluded: 'YES' },
		{ qty: 23, unitaryPrice: 14.3517391, taxIncluded: 'YES' }
	];

	order.items = rows.map(function(row, index) {
		var subtotal = Number((row.qty * row.unitaryPrice).toFixed(2));
		var tax = row.taxIncluded === 'YES' ? 0 : Number((subtotal * 0.08).toFixed(2));

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
				subtotal: subtotal,
				discount: 0,
				discount_percent: 0,
				tax: tax,
				total: Number((subtotal + tax).toFixed(2)),
				preparation_status: 'PENDING'
			}
		};
	});

	return order;
}

async function createSaleTestItem(bearer, availabilityType, stockQty) {
	var data = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer: bearer,
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
			bearer: bearer,
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
	var itemIds = [];

	for (var i = 0; i < 6; i++) {
		itemIds.push(await createSaleTestItem(bearer, 'ALWAYS'));
	}

	itemIds.push(await createSaleTestItem(bearer, 'ON_STOCK', 200));

	return itemIds;
}

async function resolveBankAccountForTest(session, storeId) {
	var accounts = await apiRequest(
		'/bank_account.php?_sort=id_DESC',
		{ bearer: session.bearer }
	);
	var rows = accounts.data || accounts.result || [];
	var totalAccounts = accounts.total || rows.length;

	if (totalAccounts > 5 && rows.length > 0) {
		var ba = rows[0].bank_account || rows[0];
		console.log('resolveBankAccountForTest: ' + totalAccounts + ' total, reusing id=' + ba.id);
		return ba.id;
	}

	console.log('resolveBankAccountForTest: ' + totalAccounts + ' total, creating new');
	var created = await apiRequest('/bank_account.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			name: uniqueName('ba'),
			alias: uniqueName('a'),
			bank: 'TB',
			account: 'A' + Date.now(),
			store_id: storeId,
			currency: 'MXN',
			status: 'ACTIVE'
		}
	});
	return (created && created.bank_account) ? created.bank_account.id : created.id;
}
