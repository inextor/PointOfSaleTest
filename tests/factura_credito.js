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
		razonSocial: 'GRUPO JFTI SOLUCIONES',
		email: 'integranet@integranet.xyz',
		rfc: 'GJS1410232N4',
		domicilioFiscal: '22887',
		regimenFiscal: '262',
		regimenCapital: '626',
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
