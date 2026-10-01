// Replica de la cotizacion 12236 (6 renglones Comex) a 16% de IVA:
// los tests no usan 8% (el PAC demo rechaza la tasa de estimulo fronterizo).
// Flujo: crear cotizacion -> crear orden -> facturar, verificando que los
// valores viajan iguales, minimo el precio unitario.
const quoteFacturacionTestConfig = {
	storeId: 1, // CEDIS: 16% y DESGLOSADA (la creacion fuerza el impuesto del almacen)
	billingDataId: 12, // copia demo de billing_data 1 con precision 2 (6 decimales rompe sumas del PAC)
	taxPercent: 16,
	priceTypeId: 1,
	serie: 'A',
	receiver: {
		razonSocial: 'GRUPO JFTI SOLUCIONES',
		email: 'integranet@integranet.xyz',
		rfc: 'GJS1410232N4',
		domicilioFiscal: '22887',
		regimenFiscal: '626',
		regimenCapital: '626',
		usoCfdi: 'G03'
	},
	// itemId + cantidad + precio con IVA, iguales a la cotizacion 12236
	lines: [
		{ itemId: 777, qty: 15, original: 95 },
		{ itemId: 826, qty: 18, original: 70 },
		{ itemId: 732, qty: 20, original: 145.5 },
		{ itemId: 778, qty: 20, original: 66 },
		{ itemId: 456, qty: 10, original: 40 },
		{ itemId: 467, qty: 15, original: 35 }
	]
};

function qfRound2(n) {
	return Math.round(n * 100) / 100;
}

// Misma formula que rest.service updateOrderItemPrice rama YES (tax_included).
// Ancla: renglón 1 -> unitario 81.90, subtotal 1228.50, iva 196.56, total 1425.
function qfTaxIncludedLine(original, qty, rate) {
	const up = Math.round(original * qty * 100) / 100;
	const unitary = qfRound2(up / (1 + rate / 100) / qty);
	const subtotal = qfRound2(unitary * qty);
	const tax = qfRound2(subtotal * (rate / 100));
	return { unitary, subtotal, tax, total: up };
}

async function qfStockOf(itemId, storeId, bearer) {
	const response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer }
	);
	const rows = response.data || [];
	return rows.length && rows[0].stock_record ? Number(rows[0].stock_record.qty) : 0;
}

async function qfSetStock(itemId, storeId, qty, bearer, comment) {
	await apiRequest('/updates/stock_adjust.php', {
		method: 'POST',
		bearer,
		body: [{
			comment: comment || 'POSTest quote facturacion',
			item_id: itemId,
			qty: qty,
			skip_merma: true,
			store_id: storeId
		}]
	});
}

async function qfCreateClient(storeId, bearer, tag) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName('POSTest Quote Facturacion ' + tag),
			phone: '0000',
			price_type_id: quoteFacturacionTestConfig.priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Client creation did not return an id: ' + JSON.stringify(client));
	}

	return client;
}

async function qfCreateQuote(client, bearer, tag) {
	const cfg = quoteFacturacionTestConfig;
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
				note: 'POSTest 16% ' + tag,
				phone: '0000',
				price_type_id: cfg.priceTypeId,
				store_id: cfg.storeId,
				sync_id: cfg.storeId + '-' + Date.now(),
				tax_percent: cfg.taxPercent,
				valid_until: validUntil.toISOString().slice(0, 10)
			},
			items: cfg.lines.map((line) => {
				const p = qfTaxIncludedLine(line.original, line.qty, cfg.taxPercent);
				return {
					quote_item: {
						discount: 0,
						discount_percent: 0,
						item_group: 0,
						item_id: line.itemId,
						item_option_id: null,
						item_option_qty: 0,
						margin_gain: 0,
						original_unitary_price: line.original,
						price_multiplier: 1,
						provider_price: 0,
						qty: line.qty,
						status: 'ACTIVE',
						subtotal: p.subtotal,
						tax: p.tax,
						tax_included: 'YES',
						total: p.total,
						unitary_price: p.unitary,
						unitary_price_meta: line.original
					}
				};
			})
		}
	});

	if (!quote.quote || !quote.quote.id) {
		throw new Error('Quote creation did not return quote.id: ' + JSON.stringify(quote));
	}

	return apiRequest('/quote_info.php?id=' + encodeURIComponent(quote.quote.id), { bearer });
}

async function qfPayOrderCash(order, client, bearer) {
	const total = Number(order.total);
	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer,
		body: {
			movements: [
				{
					bank_movement: {
						transaction_type: 'CASH',
						client_user_id: client ? client.id : null,
						total: total,
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
				tag: 'SALE',
				payment_amount: total,
				received_amount: total,
				change_amount: 0,
				currency_id: order.currency_id || 'MXN',
				facturado: 'NO',
				sync_id: '1-' + Date.now()
			}
		}
	});

	if (!paymentInfo.payment || !paymentInfo.payment.id) {
		throw new Error('Cash payment did not return payment.id: ' + JSON.stringify(paymentInfo).slice(0, 300));
	}

	return paymentInfo;
}

async function qfCreateOrderFromQuote(quoteInfo, bearer, tag) {
	const cfg = quoteFacturacionTestConfig;
	const group = Date.now();

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer,
		body: {
			order: {
				quote_id: quoteInfo.quote.id,
				store_id: cfg.storeId,
				cashier_user_id: quoteInfo.quote.created_by_user_id,
				client_name: quoteInfo.quote.name,
				client_user_id: quoteInfo.quote.client_user_id,
				currency_id: 'MXN',
				price_type_id: cfg.priceTypeId,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				paid_status: 'PENDING',
				delivery_status: 'PENDING',
				discount: 0,
				tax_percent: cfg.taxPercent,
				total: quoteInfo.items.reduce((sum, i) => sum + i.quote_item.total, 0),
				sync_id: cfg.storeId + '-' + Date.now(),
				facturacion_code: '',
				sat_serie: cfg.serie
			},
			items: quoteInfo.items.map((i) => {
				const qi = i.quote_item;
				return {
					order_item: {
						commanda_status: 'NOT_DISPLAYED',
						delivery_status: 'PENDING',
						delivered_qty: 0,
						discount: 0,
						discount_percent: 0,
						has_separator: 'NO',
						is_free_of_charge: 'NO',
						is_item_extra: 'NO',
						item_group: group,
						item_id: qi.item_id,
						item_option_id: null,
						item_option_qty: 1,
						note: '',
						original_unitary_price: qi.original_unitary_price,
						paid_qty: 0,
						preparation_status: 'PENDING',
						qty: qi.qty,
						return_required: 'NO',
						status: 'ACTIVE',
						stock_status: 'IN_STOCK',
						subtotal: qi.subtotal,
						tax: qi.tax,
						tax_included: qi.tax_included,
						total: qi.total,
						type: 'NORMAL',
						unitary_price: qi.unitary_price,
						unitary_price_meta: qi.original_unitary_price
					}
				};
			})
		}
	});

	if (!orderInfo.order || !orderInfo.order.id) {
		throw new Error('Order creation did not return order.id: ' + JSON.stringify(orderInfo));
	}

	//La orden se paga en efectivo de inmediato: sin pago, closeOrder exige
	//credito al cliente y el cliente de prueba tiene limite 0. El pago total
	//suele cerrar la orden solo; solo se cierra explicito si sigue abierta.
	const paymentInfo = await qfPayOrderCash(orderInfo.order, quoteInfo.client_user, bearer);

	let closed = await apiRequest('/order_info.php?id=' + encodeURIComponent(orderInfo.order.id), { bearer });

	if (closed.order.status !== 'CLOSED') {
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer,
			body: { method: 'closeOrder', order_id: orderInfo.order.id }
		});

		closed = await apiRequest('/order_info.php?id=' + encodeURIComponent(orderInfo.order.id), { bearer });
	}

	if (closed.order.status !== 'CLOSED') {
		throw new Error('Order was not closed, status=' + closed.order.status);
	}

	closed.payment_id = paymentInfo.payment.id;

	return closed;
}

async function qfFacturar(orderId, bearer, applyExactTotal) {
	const cfg = quoteFacturacionTestConfig;

	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer,
		body: {
			id: orderId,
			billing_data_id: cfg.billingDataId,
			sat_codigo_postal: '22800',
			sat_domicilio_fiscal_receptor: cfg.receiver.domicilioFiscal,
			sat_forma_pago: '01',
			sat_razon_social: cfg.receiver.razonSocial,
			sat_receptor_email: cfg.receiver.email,
			sat_receptor_rfc: cfg.receiver.rfc,
			sat_regimen_capital_receptor: cfg.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: cfg.receiver.regimenFiscal,
			sat_serie: cfg.serie,
			sat_uso_cfdi: cfg.receiver.usoCfdi
		}
	});

	const order = (await apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer })).order;

	const facturada = await apiRequest('/facturacion_request.php', {
		method: 'POST',
		bearer,
		body: {
			facturacion_code: order.facturacion_code,
			razon_social: cfg.receiver.razonSocial,
			email: cfg.receiver.email,
			rfc: cfg.receiver.rfc,
			domicilio_fiscal: cfg.receiver.domicilioFiscal,
			forma_de_pago: '01',
			regimen_fiscal: cfg.receiver.regimenFiscal,
			regimen_capital: cfg.receiver.regimenCapital,
			uso_cfdi: cfg.receiver.usoCfdi,
			version: '4.0',
			billing_data_id: cfg.billingDataId,
			apply_rounding_discount_adjustment: applyExactTotal
		}
	});

	const result = facturada.order || facturada;

	if (!result.sat_factura_id) {
		throw new Error('Factura was not created: ' + JSON.stringify(facturada).slice(0, 300));
	}

	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(result.sat_factura_id), { bearer });
}

async function qfFetchXmlText(bearer, attachmentId) {
	const response = await fetch(endpoint() + '/attachment.php?id=' + encodeURIComponent(attachmentId), {
		headers: { Authorization: 'Bearer ' + bearer }
	});

	if (!response.ok) {
		throw new Error('XML fetch failed with HTTP ' + response.status);
	}

	return response.text();
}

QUnit.module('Quote facturacion');

QUnit.test('respeta precio unitario sin total exacto', async function(assert) {
	assert.timeout(300000);
	assert.expect(24);

	const cfg = quoteFacturacionTestConfig;
	const anchor = qfTaxIncludedLine(95, 15, cfg.taxPercent);
	assert.deepEqual(
		[anchor.unitary, anchor.subtotal, anchor.tax, anchor.total],
		[81.9, 1228.5, 196.56, 1425],
		'formula local ancla renglón 1 (81.90 / 1228.50 / 196.56 / 1425)'
	);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	// Stock suficiente en el almacen de prueba y restauracion al final.
	const originals = {};
	for (const line of cfg.lines) {
		originals[line.itemId] = await qfStockOf(line.itemId, cfg.storeId, session.bearer);
	}
	for (const line of cfg.lines) {
		await qfSetStock(line.itemId, cfg.storeId, originals[line.itemId] + line.qty, session.bearer, 'POSTest quote facturacion OFF');
	}

	try {
		const client = await qfCreateClient(cfg.storeId, session.bearer, 'OFF');
		assert.ok(client.id, 'created test client');

		const quoteInfo = await qfCreateQuote(client, session.bearer, 'OFF');
		assert.ok(quoteInfo.quote.id, 'created quote ' + quoteInfo.quote.id);
		assert.equal(quoteInfo.quote.approved_status, 'PENDING', 'quote is PENDING');

		quoteInfo.items.forEach((item, index) => {
			const expected = qfTaxIncludedLine(cfg.lines[index].original, cfg.lines[index].qty, cfg.taxPercent);
			assert.deepEqual(
				[item.quote_item.unitary_price, item.quote_item.subtotal, item.quote_item.tax, item.quote_item.total],
				[expected.unitary, expected.subtotal, expected.tax, expected.total],
				'quote conserva valores enviados renglón ' + (index + 1)
			);
		});

		const orderInfo = await qfCreateOrderFromQuote(quoteInfo, session.bearer, 'OFF');
		assert.ok(orderInfo.order.id, 'created order ' + orderInfo.order.id);
		assert.ok(orderInfo.payment_id, 'orden pagada en efectivo ' + orderInfo.payment_id);
		assert.equal(Number(orderInfo.order.tax_percent), cfg.taxPercent, 'order usa 16%');

		orderInfo.items.forEach((orderItemInfo, index) => {
			const quoteItem = quoteInfo.items[index].quote_item;
			const orderItem = orderItemInfo.order_item;
			assert.deepEqual(
				[orderItem.unitary_price, orderItem.subtotal, orderItem.tax, orderItem.total],
				[quoteItem.unitary_price, quoteItem.subtotal, quoteItem.tax, quoteItem.total],
				'orden hereda valores exactos de cotizacion renglón ' + (index + 1)
			);
		});

		const satFactura = await qfFacturar(orderInfo.order.id, session.bearer, false);
		assert.ok(satFactura.uuid, 'CFDI timbrado ' + satFactura.uuid);
		assert.equal(satFactura.type, 'NORMAL', 'sat_factura es NORMAL');

		const xml = await qfFetchXmlText(session.bearer, satFactura.xml_attachment_id);
		assert.ok(xml.indexOf('ValorUnitario="81.90"') !== -1, 'XML respeta unitario 81.90');
		assert.ok(xml.indexOf('Importe="1228.50"') !== -1, 'XML respeta importe 1228.50');
	}
	finally {
		for (const line of cfg.lines) {
			await qfSetStock(line.itemId, cfg.storeId, originals[line.itemId], session.bearer, 'POSTest restauracion');
		}
	}
});

QUnit.test('total exacto del ticket con flag prendido', async function(assert) {
	assert.timeout(300000);
	assert.expect(8);

	const cfg = quoteFacturacionTestConfig;
	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const originals = {};
	for (const line of cfg.lines) {
		originals[line.itemId] = await qfStockOf(line.itemId, cfg.storeId, session.bearer);
	}
	for (const line of cfg.lines) {
		await qfSetStock(line.itemId, cfg.storeId, originals[line.itemId] + line.qty, session.bearer, 'POSTest quote facturacion ON');
	}

	try {
		const client = await qfCreateClient(cfg.storeId, session.bearer, 'ON');
		assert.ok(client.id, 'created test client');

		const quoteInfo = await qfCreateQuote(client, session.bearer, 'ON');
		assert.ok(quoteInfo.quote.id, 'created quote ' + quoteInfo.quote.id);

		const orderInfo = await qfCreateOrderFromQuote(quoteInfo, session.bearer, 'ON');
		assert.ok(orderInfo.order.id, 'created order ' + orderInfo.order.id);
		assert.ok(orderInfo.payment_id, 'orden pagada en efectivo ' + orderInfo.payment_id);
		assert.equal(Number(orderInfo.order.total), 7840, 'order total 7840');

		const satFactura = await qfFacturar(orderInfo.order.id, session.bearer, true);
		assert.ok(satFactura.uuid, 'CFDI timbrado ' + satFactura.uuid);

		const xml = await qfFetchXmlText(session.bearer, satFactura.xml_attachment_id);
		assert.ok(xml.indexOf('Total="7840.00"') !== -1, 'comprobante cuadra al total exacto del ticket 7840.00');
	}
	finally {
		for (const line of cfg.lines) {
			await qfSetStock(line.itemId, cfg.storeId, originals[line.itemId], session.bearer, 'POSTest restauracion');
		}
	}
});
