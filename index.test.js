QUnit.config.autostart = false;

document.getElementById('endpoint').value = window.location.protocol + '//' + window.location.host + '/PointOfSale';
//document.getElementById('endpoint').value = 'https://nutriven.integranet.xyz/api'

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
		const backendMessage = data && (data.error || data.message);
		const error = new Error(
			(options.method || 'GET') + ' ' + path + ' failed with HTTP ' + response.status
			+ (backendMessage ? ': ' + backendMessage : '')
		);
		error.response = data;
		throw error;
	}

	if (options.includeStatus) {
		return { status: response.status, data };
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

function mysqlDate(date) {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

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
	serie: 'A',
	agent: {
		name: 'diego tapia',
		username: 'diego.tapia.agent',
		phone: '5555555555'
	}
};

const notaCreditoTestConfig = {
	storeId: 1,
	billingDataId: 1,
	priceTypeId: 1,
	price: 1000,
	qty: 1,
	taxPercent: 16,
	itemName: 'Nota Credito No Stock',
	receiver: facturaCreditTestConfig.receiver,
	serie: facturaCreditTestConfig.serie,
	formaPago: '03',
	tipoRelacion: '01'
};

function taxSplitFromTaxIncluded(total, taxPercent) {
	const subtotal = Number((total / (1 + (taxPercent / 100))).toFixed(2));
	const tax = Number((total - subtotal).toFixed(2));
	return { subtotal, tax };
}

function getUserRows(response) {
	return response && response.data ? response.data.map((row) => row.user || row) : [];
}

async function findOrCreateFacturaAgent(bearer) {
	const found = await apiRequest('/user.php?type=USER&name=' + encodeURIComponent(facturaCreditTestConfig.agent.name), { bearer });
	let agent = getUserRows(found).find((user) => user.name && user.name.toLowerCase() === facturaCreditTestConfig.agent.name);

	if (!agent) {
		agent = await apiRequest('/user.php', {
			method: 'POST',
			bearer,
			body: {
				name: facturaCreditTestConfig.agent.name,
				username: facturaCreditTestConfig.agent.username,
				password: facturaCreditTestConfig.agent.username,
				phone: facturaCreditTestConfig.agent.phone,
				status: 'ACTIVE',
				store_id: facturaCreditTestConfig.storeId,
				type: 'USER'
			}
		});
	}

	if (!agent.phone) {
		agent = await apiRequest('/user.php', {
			method: 'PUT',
			bearer,
			body: {
				id: agent.id,
				phone: facturaCreditTestConfig.agent.phone
			}
		});
	}

	if (!agent.id) {
		throw new Error('Agent response did not include id: ' + JSON.stringify(agent));
	}

	return agent;
}

async function createCreditClient(bearer, agent) {
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

	return apiRequest('/user.php', {
		method: 'PUT',
		bearer,
		body: {
			id: client.id,
			created_by_user_id: agent.id
		}
	});
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

async function createNotaCreditoItem(bearer) {
	const item = await apiRequest('/item_info.php', {
		method: 'POST',
		bearer,
		body: {
			item: {
				applicable_tax: 'PERCENT',
				availability_type: 'ALWAYS',
				clave_sat: '53111603',
				currency_id: 'MXN',
				name: uniqueName(notaCreditoTestConfig.itemName),
				note_required: 'NO',
				on_sale: 'YES',
				reference_price: notaCreditoTestConfig.price,
				status: 'ACTIVE',
				tax_percent: notaCreditoTestConfig.taxPercent,
				unidad_medida_sat_id: 'H87'
			}
		}
	});

	if (!item.item || !item.item.id) {
		throw new Error('Nota credito item creation response did not include item.id: ' + JSON.stringify(item));
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

async function addNotaCreditoItemPrice(itemId, store, bearer) {
	const price = await apiRequest('/price.php', {
		method: 'POST',
		bearer,
		body: {
			currency_id: store.default_currency_id || 'MXN',
			item_id: itemId,
			percent: 0,
			price: notaCreditoTestConfig.price,
			price_list_id: store.price_list_id || 1,
			price_type_id: notaCreditoTestConfig.priceTypeId,
			tax_included: 'YES'
		}
	});

	if (!price.id) {
		throw new Error('Nota credito price creation response did not include id: ' + JSON.stringify(price));
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

function notaCreditoOrderPayload(item, store, sessionUser) {
	const total = notaCreditoTestConfig.price * notaCreditoTestConfig.qty;
	const split = taxSplitFromTaxIncluded(total, notaCreditoTestConfig.taxPercent);

	return {
		order: {
			amount_paid: 0,
			billing_data_id: notaCreditoTestConfig.billingDataId,
			cashier_user_id: sessionUser.id,
			client_name: 'PUBLICO GRAL',
			currency_id: store.default_currency_id || 'MXN',
			discount: 0,
			discount_calculated: 0,
			facturado: 'NO',
			paid_status: 'PENDING',
			price_type_id: notaCreditoTestConfig.priceTypeId,
			sat_codigo_postal: notaCreditoTestConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: notaCreditoTestConfig.receiver.domicilioFiscal,
			sat_forma_pago: notaCreditoTestConfig.formaPago,
			sat_ieps: 0,
			sat_isr: 0,
			sat_razon_social: notaCreditoTestConfig.receiver.razonSocial,
			sat_receptor_email: notaCreditoTestConfig.receiver.email,
			sat_receptor_rfc: notaCreditoTestConfig.receiver.rfc,
			sat_regimen_capital_receptor: notaCreditoTestConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: notaCreditoTestConfig.receiver.regimenFiscal,
			sat_serie: notaCreditoTestConfig.serie,
			sat_uso_cfdi: notaCreditoTestConfig.receiver.usoCfdi,
			service_type: 'QUICK_SALE',
			status: 'PENDING',
			store_id: notaCreditoTestConfig.storeId,
			subtotal: split.subtotal,
			sync_id: createAgentSyncId(sessionUser && sessionUser.id),
			tax: split.tax,
			tax_percent: notaCreditoTestConfig.taxPercent,
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
					qty: notaCreditoTestConfig.qty,
					item_option_qty: 1,
					paid_qty: 0,
					original_unitary_price: notaCreditoTestConfig.price,
					unitary_price: split.subtotal,
					unitary_price_meta: notaCreditoTestConfig.price,
					subtotal: split.subtotal,
					discount: 0,
					discount_percent: 0,
					tax: split.tax,
					total,
					type: 'NORMAL',
					preparation_status: 'PENDING'
				}
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

function notaCreditoFacturaRequestPayload(order) {
	return {
		facturacion_code: order.facturacion_code,
		razon_social: notaCreditoTestConfig.receiver.razonSocial,
		email: notaCreditoTestConfig.receiver.email,
		rfc: notaCreditoTestConfig.receiver.rfc,
		domicilio_fiscal: notaCreditoTestConfig.receiver.domicilioFiscal,
		forma_de_pago: notaCreditoTestConfig.formaPago,
		sat_serie: notaCreditoTestConfig.serie,
		regimen_fiscal: notaCreditoTestConfig.receiver.regimenFiscal,
		regimen_capital: notaCreditoTestConfig.receiver.regimenCapital,
		uso_cfdi: notaCreditoTestConfig.receiver.usoCfdi,
		version: '4.0',
		billing_data_id: notaCreditoTestConfig.billingDataId,
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

async function updateOrderNotaCreditoFacturaData(order, bearer) {
	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer,
		body: {
			id: order.id,
			billing_data_id: notaCreditoTestConfig.billingDataId,
			sat_codigo_postal: notaCreditoTestConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: notaCreditoTestConfig.receiver.domicilioFiscal,
			sat_forma_pago: notaCreditoTestConfig.formaPago,
			sat_razon_social: notaCreditoTestConfig.receiver.razonSocial,
			sat_receptor_email: notaCreditoTestConfig.receiver.email,
			sat_receptor_rfc: notaCreditoTestConfig.receiver.rfc,
			sat_regimen_capital_receptor: notaCreditoTestConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: notaCreditoTestConfig.receiver.regimenFiscal,
			sat_serie: notaCreditoTestConfig.serie,
			sat_uso_cfdi: notaCreditoTestConfig.receiver.usoCfdi
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
	assert.expect(14);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const store = await apiRequest('/store.php?id=' + facturaCreditTestConfig.storeId, { bearer: session.bearer });
	assert.ok(store.id, 'loaded test store');

	const agent = await findOrCreateFacturaAgent(session.bearer);
	assert.equal(agent.name.toLowerCase(), facturaCreditTestConfig.agent.name, 'loaded factura agent');

	const client = await createCreditClient(session.bearer, agent);
	assert.equal(Number(client.credit_limit), 30000, 'created credit client with 30000 limit');
	assert.equal(Number(client.created_by_user_id), Number(agent.id), 'assigned factura agent to client');

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
		includeStatus: true,
		body: {
			payment_id: paymentInfo.payment.id,
			transaccion: 'CP-' + paymentInfo.payment.id + '-' + Date.now()
		}
	});

	assert.equal(complemento.status, 200, 'generated payment complement');
});

QUnit.test('nota de credito flow with non-stock item', async function(assert) {
	assert.timeout(120000);
	assert.expect(13);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const store = await apiRequest('/store.php?id=' + notaCreditoTestConfig.storeId, { bearer: session.bearer });
	assert.ok(store.id, 'loaded test store');

	const item = await createNotaCreditoItem(session.bearer);
	assert.equal(item.availability_type, 'ALWAYS', 'created non-stockable item');

	const price = await addNotaCreditoItemPrice(item.id, store, session.bearer);
	assert.equal(Number(price.price), notaCreditoTestConfig.price, 'created item price 1000');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: notaCreditoOrderPayload(item, store, session.user)
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'created order');
	assert.equal(Number(orderInfo.order.total), notaCreditoTestConfig.price, 'order total is 1000');

	const updatedOrderInfo = await updateOrderNotaCreditoFacturaData(orderInfo.order, session.bearer);
	const orderToFactura = updatedOrderInfo.order || updatedOrderInfo;
	assert.equal(orderToFactura.sat_forma_pago, notaCreditoTestConfig.formaPago, 'saved factura payment form');

	const facturada = await apiRequest('/facturacion_request.php', {
		method: 'POST',
		bearer: session.bearer,
		body: notaCreditoFacturaRequestPayload(orderToFactura)
	});
	const facturadaOrder = facturada.order || facturada;
	assert.ok(facturadaOrder.sat_factura_id, 'generated original factura');

	const originalSatFactura = await apiRequest('/sat_factura.php?id=' + encodeURIComponent(facturadaOrder.sat_factura_id), {
		bearer: session.bearer
	});
	assert.equal(originalSatFactura.type, 'NORMAL', 'original sat_factura is NORMAL');

	const nota = await apiRequest('/NotaDeCredito.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			sat_factura_id: facturadaOrder.sat_factura_id,
			motivo: notaCreditoTestConfig.tipoRelacion,
			total: notaCreditoTestConfig.price
		}
	});
	assert.ok(nota.sat_factura_id, 'generated nota de credito');

	const notaSatFactura = await apiRequest('/sat_factura.php?id=' + encodeURIComponent(nota.sat_factura_id), {
		bearer: session.bearer
	});
	assert.equal(notaSatFactura.type, 'NOTA_CREDITO', 'nota sat_factura is NOTA_CREDITO');
	assert.equal(Number(notaSatFactura.parent_sat_factura_id), Number(facturadaOrder.sat_factura_id), 'nota points to original sat_factura');

	const reloadedOrder = await apiRequest('/order_info.php?id=' + encodeURIComponent(facturadaOrder.id), { bearer: session.bearer });
	assert.equal(Number(reloadedOrder.order.sat_factura_id), Number(facturadaOrder.sat_factura_id), 'order keeps original factura id');
});

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

	if (item.commission_type === 'STORE_PRICE_TYPE_PERCENT') {
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
		{ commission_type: 'STORE_PRICE_TYPE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1, original_unitary_price: 1000, unitary_price: 990 },
		{ status: 'ACTIVE', base_percent: 2, discount_reduction_per_percent: 0.2 }
	);

	assert.equal(commission, 18, '2.00 base minus 0.20 for 1% discount gives 1.80% commission');
});

QUnit.test('store price type percent can derive discount from unit prices', function(assert) {
	const commission = calculateTestCommission(
		{ commission_type: 'STORE_PRICE_TYPE_PERCENT', commission: 0 },
		{ qty: 1, total: 900, discount_percent: 0, original_unitary_price: 1000, unitary_price: 900 },
		{ status: 'ACTIVE', base_percent: 5, discount_reduction_per_percent: 0.1 }
	);

	assert.equal(commission, 36, '10% derived discount lowers 5% commission to 4%');
});

QUnit.test('missing inactive and excessive discount rules return safe values', function(assert) {
	assert.equal(calculateTestCommission(
		{ commission_type: 'STORE_PRICE_TYPE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1 },
		null
	), 0, 'missing rule returns zero');

	assert.equal(calculateTestCommission(
		{ commission_type: 'STORE_PRICE_TYPE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 1 },
		{ status: 'DELETED', base_percent: 2, discount_reduction_per_percent: 0.2 }
	), 0, 'inactive rule returns zero');

	assert.equal(calculateTestCommission(
		{ commission_type: 'STORE_PRICE_TYPE_PERCENT', commission: 0 },
		{ qty: 1, total: 1000, discount_percent: 50 },
		{ status: 'ACTIVE', base_percent: 2, discount_reduction_per_percent: 0.2 }
	), 0, 'final commission percent is clamped to zero');
});

QUnit.start();
