// Doble facturacion al 16%: llamar facturacion_request.php dos veces para la
// misma orden no debe crear una segunda fila sat_factura. Datos reutilizados
// de los fixtures al 16% de factura_credito.js (precio 116 con IVA incluido,
// mismo receptor), con el flujo de orden sin stock de la nota de credito.
var facturaReuseConfig = {
	storeId: 1,
	billingDataId: 1,
	priceTypeId: 1,
	price: 116,
	qty: 1,
	taxPercent: 16,
	itemName: 'Factura Reuse 16 Item',
	receiver: {
		razonSocial: 'GRUPO JFTI SOLUCIONES',
		email: 'integranet@integranet.xyz',
		rfc: 'GJS1410232N4',
		domicilioFiscal: '22887',
		regimenFiscal: '626',
		regimenCapital: '626',
		usoCfdi: 'G03'
	},
	serie: 'A',
	formaPago: '03'
};

var reuseFirstBill = null;
var reuseOrderId = null;

function frTaxSplit(total, taxPercent) {
	const subtotal = Number((total / (1 + (taxPercent / 100))).toFixed(2));
	const tax = Number((total - subtotal).toFixed(2));
	return { subtotal: subtotal, tax: tax };
}

async function frCreateClient(bearer, agentUser) {
	const timestamp = Date.now();
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer: bearer,
		body: {
			name: 'test reuse ' + timestamp,
			credit_days: 30,
			credit_limit: 30000,
			payment_option: 'STORE',
			price_type_id: facturaReuseConfig.priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT',
			username: 'test-reuse-factura-' + timestamp
		}
	});

	if (!client.id) {
		throw new Error('Client creation response did not include id: ' + JSON.stringify(client));
	}

	return apiRequest('/user.php', {
		method: 'PUT',
		bearer: bearer,
		body: {
			id: client.id,
			created_by_user_id: agentUser.id
		}
	});
}

async function frCreateItem(bearer) {
	return getOrCreateItem(bearer, {
		applicable_tax: 'PERCENT',
		availability_type: 'ALWAYS',
		clave_sat: '53111603',
		currency_id: 'MXN',
		name: facturaReuseConfig.itemName,
		note_required: 'NO',
		on_sale: 'YES',
		reference_price: facturaReuseConfig.price,
		status: 'ACTIVE',
		tax_percent: facturaReuseConfig.taxPercent,
		unidad_medida_sat_id: 'H87'
	});
}

async function frAddPrice(itemId, store, bearer) {
	const price = await apiRequest('/price.php', {
		method: 'POST',
		bearer: bearer,
		body: {
			currency_id: store.default_currency_id || 'MXN',
			item_id: itemId,
			percent: 0,
			price: facturaReuseConfig.price,
			price_list_id: store.price_list_id || 1,
			price_type_id: facturaReuseConfig.priceTypeId,
			tax_included: 'YES'
		}
	});

	if (!price.id) {
		throw new Error('Price creation response did not include id: ' + JSON.stringify(price));
	}

	return price;
}

function frOrderPayload(item, client, store, sessionUser) {
	const total = facturaReuseConfig.price * facturaReuseConfig.qty;
	const split = frTaxSplit(total, facturaReuseConfig.taxPercent);

	return {
		order: {
			amount_paid: 0,
			billing_data_id: facturaReuseConfig.billingDataId,
			cashier_user_id: sessionUser.id,
			client_name: client.name,
			client_user_id: client.id,
			currency_id: store.default_currency_id || 'MXN',
			discount: 0,
			discount_calculated: 0,
			facturado: 'NO',
			paid_status: 'PENDING',
			price_type_id: facturaReuseConfig.priceTypeId,
			sat_codigo_postal: facturaReuseConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: facturaReuseConfig.receiver.domicilioFiscal,
			sat_forma_pago: facturaReuseConfig.formaPago,
			sat_ieps: 0,
			sat_isr: 0,
			sat_razon_social: facturaReuseConfig.receiver.razonSocial,
			sat_receptor_email: facturaReuseConfig.receiver.email,
			sat_receptor_rfc: facturaReuseConfig.receiver.rfc,
			sat_regimen_capital_receptor: facturaReuseConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: facturaReuseConfig.receiver.regimenFiscal,
			sat_serie: facturaReuseConfig.serie,
			sat_uso_cfdi: facturaReuseConfig.receiver.usoCfdi,
			service_type: 'QUICK_SALE',
			status: 'PENDING',
			store_id: facturaReuseConfig.storeId,
			subtotal: split.subtotal,
			sync_id: createAgentSyncId(sessionUser && sessionUser.id),
			tax: split.tax,
			tax_percent: facturaReuseConfig.taxPercent,
			total: total
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
					qty: facturaReuseConfig.qty,
					item_option_qty: 1,
					paid_qty: 0,
					original_unitary_price: facturaReuseConfig.price,
					unitary_price: split.subtotal,
					unitary_price_meta: facturaReuseConfig.price,
					subtotal: split.subtotal,
					discount: 0,
					discount_percent: 0,
					tax: split.tax,
					total: total,
					type: 'NORMAL',
					preparation_status: 'PENDING'
				}
			}
		]
	};
}

async function frSetFacturaData(order, bearer) {
	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer: bearer,
		body: {
			id: order.id,
			billing_data_id: facturaReuseConfig.billingDataId,
			sat_codigo_postal: facturaReuseConfig.receiver.domicilioFiscal,
			sat_domicilio_fiscal_receptor: facturaReuseConfig.receiver.domicilioFiscal,
			sat_forma_pago: facturaReuseConfig.formaPago,
			sat_razon_social: facturaReuseConfig.receiver.razonSocial,
			sat_receptor_email: facturaReuseConfig.receiver.email,
			sat_receptor_rfc: facturaReuseConfig.receiver.rfc,
			sat_regimen_capital_receptor: facturaReuseConfig.receiver.regimenCapital,
			sat_regimen_fiscal_receptor: facturaReuseConfig.receiver.regimenFiscal,
			sat_serie: facturaReuseConfig.serie,
			sat_uso_cfdi: facturaReuseConfig.receiver.usoCfdi
		}
	});

	return apiRequest('/order_info.php?id=' + encodeURIComponent(order.id), { bearer: bearer });
}

function frBillingPayload(order) {
	return {
		facturacion_code: order.facturacion_code,
		razon_social: facturaReuseConfig.receiver.razonSocial,
		email: facturaReuseConfig.receiver.email,
		rfc: facturaReuseConfig.receiver.rfc,
		domicilio_fiscal: facturaReuseConfig.receiver.domicilioFiscal,
		forma_de_pago: facturaReuseConfig.formaPago,
		sat_serie: facturaReuseConfig.serie,
		regimen_fiscal: facturaReuseConfig.receiver.regimenFiscal,
		regimen_capital: facturaReuseConfig.receiver.regimenCapital,
		uso_cfdi: facturaReuseConfig.receiver.usoCfdi,
		version: '4.0',
		billing_data_id: facturaReuseConfig.billingDataId,
		apply_rounding_discount_adjustment: false
	};
}

async function frFetchSatFactura(bearer, satFacturaId) {
	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(satFacturaId), { bearer: bearer });
}

QUnit.module('Facturacion doble al 16%');

QUnit.test('primera llamada deja una sola fila vinculada', async function(assert) {
	assert.timeout(300000);
	assert.expect(14);

	const session = await login();
	assert.ok(session.bearer, 'sesion iniciada');

	const store = await apiRequest('/store.php?id=' + facturaReuseConfig.storeId, { bearer: session.bearer });
	assert.ok(store.id, 'sucursal cargada');
	assert.equal(Number(store.tax_percent), facturaReuseConfig.taxPercent, 'la sucursal cobra 16%');

	const client = await frCreateClient(session.bearer, session.user);
	assert.ok(client.id, 'cliente creado');

	const item = await frCreateItem(session.bearer);
	assert.ok(item.id, 'articulo listo');

	const price = await frAddPrice(item.id, store, session.bearer);
	assert.equal(Number(price.price), facturaReuseConfig.price, 'precio 116 creado');

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: frOrderPayload(item, client, store, session.user)
	});
	assert.ok(orderInfo.order && orderInfo.order.id, 'orden creada');
	assert.equal(Number(orderInfo.order.total), facturaReuseConfig.price, 'total de la orden es 116');
	reuseOrderId = orderInfo.order.id;

	await apiRequest('/updates.php', {
		method: 'POST',
		bearer: session.bearer,
		body: { method: 'closeOrder', order_id: reuseOrderId }
	});

	const closedOrderInfo = await apiRequest('/order_info.php?id=' + encodeURIComponent(reuseOrderId), { bearer: session.bearer });
	assert.equal(closedOrderInfo.order.status, 'CLOSED', 'orden cerrada');

	const withData = await frSetFacturaData(closedOrderInfo.order, session.bearer);
	const orderToBill = withData.order || withData;
	assert.equal(orderToBill.sat_forma_pago, facturaReuseConfig.formaPago, 'forma de pago guardada');

	let stamped = false;
	try {
		const facturada = await apiRequest('/facturacion_request.php', {
			method: 'POST',
			bearer: session.bearer,
			body: frBillingPayload(orderToBill)
		});
		const billed = facturada.order || facturada;
		stamped = !!billed.sat_factura_id;
		assert.ok(stamped, 'primera llamada timbro y dejo sat_factura_id');
	} catch (error) {
		stamped = false;
		assert.ok(
			error.message.indexOf('FI778') !== -1,
			'primera llamada fallo en el PAC de forma controlada'
		);
	}

	const linked = await apiRequest('/order_info.php?id=' + encodeURIComponent(reuseOrderId), { bearer: session.bearer });
	assert.ok(linked.order.sat_factura_id, 'la orden quedo vinculada aunque falle el timbrado');

	const list = await apiRequest('/sat_factura.php?order_id=' + encodeURIComponent(reuseOrderId), { bearer: session.bearer });
	assert.equal(Number(list.total), 1, 'una sola fila sat_factura');

	const row = (list.data || []).map(function(entry) { return entry.sat_factura || entry; })[0];
	assert.ok(row.transaccion, 'la fila tiene transaccion');

	reuseFirstBill = {
		code: orderToBill.facturacion_code,
		satFacturaId: Number(linked.order.sat_factura_id),
		transaccion: row.transaccion,
		stamped: stamped,
		email: orderToBill.sat_receptor_email,
		bearer: session.bearer
	};
});

QUnit.test('segunda llamada con datos distintos reutiliza la fila', async function(assert) {
	assert.timeout(300000);
	assert.expect(7);
	assert.ok(reuseFirstBill, 'la primera llamada dejo datos');

	const secondBody = frBillingPayload({ facturacion_code: reuseFirstBill.code });
	secondBody.email = 'reuse2@integranet.xyz';
	secondBody.note = 'segunda llamada datos distintos';

	let rejected = null;
	let secondOk = null;
	try {
		const second = await apiRequest('/facturacion_request.php', {
			method: 'POST',
		bearer: reuseFirstBill.bearer,
			body: secondBody
		});
		secondOk = second.order || second;
	} catch (error) {
		rejected = error;
	}

	if (reuseFirstBill.stamped) {
		assert.ok(
			rejected && rejected.message.indexOf('ya esta facturada') !== -1,
			'segunda llamada rechazada porque ya esta timbrada'
		);
	} else {
		assert.ok(
			!rejected || rejected.message.indexOf('ya esta facturada') === -1,
			'segunda llamada paso el filtro de facturada'
		);
	}

	const reloaded = await apiRequest('/order_info.php?id=' + encodeURIComponent(reuseOrderId), { bearer: reuseFirstBill.bearer });
	assert.equal(Number(reloaded.order.sat_factura_id), reuseFirstBill.satFacturaId, 'mismo sat_factura_id');

	const list = await apiRequest('/sat_factura.php?order_id=' + encodeURIComponent(reuseOrderId), { bearer: reuseFirstBill.bearer });
	assert.equal(Number(list.total), 1, 'sigue una sola fila sat_factura');

	const rows = (list.data || []).map(function(entry) { return entry.sat_factura || entry; });
	assert.equal(Number(rows[0].id), reuseFirstBill.satFacturaId, 'la fila es la misma');
	assert.equal(rows[0].transaccion, reuseFirstBill.transaccion, 'la transaccion no cambio');

	if (reuseFirstBill.stamped) {
		assert.equal(reloaded.order.sat_receptor_email, reuseFirstBill.email, 'datos intactos tras el rechazo');
	} else {
		assert.equal(reloaded.order.sat_receptor_email, secondBody.email, 'la fila reutilizada tomo los datos nuevos');
	}
});
