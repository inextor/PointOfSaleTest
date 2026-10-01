// Caso 100.04 al 16%: subtotal 100.04 + IVA 16% => exacto 116.0464:
//   truncado 116.04 vs redondeado 116.05 (1 centavo de diferencia).
// El primer test lo discrimina en matematica local. El segundo timbra de
// verdad: hoy solo se timbra a precision 6 y el PAC redondea 116.0464 a
// 116.05 (el IVA truncado 16.00 lo rechaza con CFDI40180), asi que el CFDI
// se afirma con total 116.05 y unitario a 6 decimales.
// El PAC demo rechaza la tasa 8% de estimulo fronterizo, por eso el caso es al 16%.
const facturaTruncadoConfig = {
	storeId: 1, // CEDIS: 16% y DESGLOSADA (igual que quote_facturacion.js)
	billingDataId: 1, // precision 6 con credenciales PAC demo (hoy solo
	// timbra a precision 6; ver ftResolveBillingDataId)
	// Renglon como la orden hecha a mano 175545: 100.03 + 16.00 = 116.04,
	// autoconsistente (el backend lo respeta tal cual, sin recalcular).
	lineCash: { qty: 1, original: 116.04, unitary: 100.03, subtotal: 100.03, tax: 16.00, total: 116.04 },
	taxPercent: 16,
	priceTypeId: 1,
	currencyId: 'MXN',
	serie: 'A',
	itemName: 'Factura Truncado 16 Item',
	itemCode: 'FTRUNC16-1',
	claveSat: '31211506',
	unit: 'H87',
	// Precio con IVA 116.05 -> subtotal 100.04, iva 16.01, total 116.05
	// (consistente con OrderUtils::applyPrice rama YES: round(116.05/1.16) = 100.04).
	line: { qty: 1, original: 116.05, unitary: 100.04, subtotal: 100.04, tax: 16.01, total: 116.05 },
	exactTotal: 116.0464,
	truncatedTotal: 116.04,
	roundedTotal: 116.05,
	receiver: {
		razonSocial: 'GRUPO JFTI SOLUCIONES',
		email: 'integranet@integranet.xyz',
		rfc: 'GJS1410232N4',
		domicilioFiscal: '22887',
		regimenFiscal: '626',
		regimenCapital: '626',
		usoCfdi: 'G03'
	}
};

function ftRound2(n) {
	return Math.round(n * 100) / 100;
}

// Misma operacion que el backend: floor(exacto*100)/100.
function ftTruncate2(n) {
	return Math.floor(n * 100) / 100;
}

async function ftGetStore(storeId, bearer) {
	const response = await apiRequest('/store.php?id=' + encodeURIComponent(storeId), { bearer });
	return response.store || response;
}

async function ftStockOf(itemId, storeId, bearer) {
	const response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer }
	);
	const rows = response.data || [];
	return rows.length && rows[0].stock_record ? Number(rows[0].stock_record.qty) : 0;
}

async function ftSetStock(itemId, storeId, qty, bearer, comment) {
	await apiRequest('/updates/stock_adjust.php', {
		method: 'POST',
		bearer,
		body: [{
			comment: comment || 'POSTest factura truncado',
			item_id: itemId,
			qty: qty,
			skip_merma: true,
			store_id: storeId
		}]
	});
}

async function ftResolveItem(bearer) {
	const cfg = facturaTruncadoConfig;
	const wanted = {
		applicable_tax: 'DEFAULT', // el impuesto lo pone la sucursal (16%)
		availability_type: 'ON_STOCK',
		clave_sat: cfg.claveSat,
		code: cfg.itemCode,
		currency_id: cfg.currencyId,
		measurement_unit: 'Pieza',
		name: cfg.itemName,
		note_required: 'NO',
		on_sale: 'NO',
		reference_price: cfg.line.unitary,
		return_action: 'RETURN_TO_STOCK',
		status: 'ACTIVE',
		tax_percent: 0,
		unidad_medida_sat_id: cfg.unit
	};
	let item = await getOrCreateItem(bearer, wanted);

	// Si el articulo ya existia con otros campos (corrida vieja), se corrige:
	// un clave_sat/unidad/disponibilidad distinto romperia stock, orden o CFDI.
	const fixes = {};
	['applicable_tax', 'availability_type', 'clave_sat', 'measurement_unit', 'status', 'tax_percent', 'unidad_medida_sat_id'].forEach(function(key) {
		if (item[key] !== undefined && String(item[key]) !== String(wanted[key])) {
			fixes[key] = wanted[key];
		}
	});

	if (Object.keys(fixes).length > 0) {
		fixes.id = item.id;
		const updated = await apiRequest('/item_info.php', {
			method: 'PUT',
			bearer,
			body: fixes
		});
		console.log('Factura truncado: articulo ' + item.id + ' actualizado ' + JSON.stringify(fixes));
		item = updated.item || updated;
	}

	// Precios tax_included iguales a los totales de los renglones, para que el
	// articulo sea vendible y pagable tambien desde el POS. Idempotente.
	const search = await apiRequest(
		'/price.php?item_id=' + encodeURIComponent(item.id)
		+ '&price_list_id=1&price_type_id=' + cfg.priceTypeId,
		{ bearer }
	);
	const rows = (search.data || search.result || []).map(function(r) { return r.price || r; });

	for (const wantedTotal of [cfg.line.total, cfg.lineCash.total]) {
		const existing = rows.find(function(r) {
			return r && r.price !== undefined && ftRound2(r.price) === ftRound2(wantedTotal);
		});

		if (!existing) {
			const createdPrice = await apiRequest('/price.php', {
				method: 'POST',
				bearer,
				body: {
					currency_id: cfg.currencyId,
					item_id: item.id,
					percent: 0,
					price: wantedTotal,
					price_list_id: 1,
					price_type_id: cfg.priceTypeId,
					tax_included: 'YES'
				}
			});
			rows.push(createdPrice.price || createdPrice);
		}
	}

	return item;
}

async function ftCreateClient(storeId, bearer, namePrefix) {
	const cfg = facturaTruncadoConfig;
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName(namePrefix || 'POSTest Factura Truncado'),
			phone: '0000',
			price_type_id: cfg.priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Client creation did not return an id: ' + JSON.stringify(client));
	}

	return client;
}

async function ftCreateQuote(client, itemId, bearer, lineParam) {
	const cfg = facturaTruncadoConfig;
	const line = lineParam === undefined ? cfg.line : lineParam;
	const validUntil = new Date();
	validUntil.setDate(validUntil.getDate() + 7);

	const quote = await apiRequest('/quote_info.php', {
		method: 'POST',
		bearer,
		body: {
			quote: {
				approved_status: 'PENDING',
				client_user_id: client.id,
				currency_id: cfg.currencyId,
				email: '',
				name: client.name,
				note: 'POSTest factura truncado 16%',
				phone: '0000',
				price_type_id: cfg.priceTypeId,
				store_id: cfg.storeId,
				sync_id: cfg.storeId + '-' + Date.now(),
				tax_percent: cfg.taxPercent,
				valid_until: validUntil.toISOString().slice(0, 10)
			},
			items: [{
				quote_item: {
					discount: 0,
					discount_percent: 0,
					item_group: 0,
					item_id: itemId,
					item_option_id: null,
					item_option_qty: 0,
					margin_gain: 0,
					original_unitary_price: line.original,
					price_multiplier: 1,
					provider_price: 0,
					qty: line.qty,
					status: 'ACTIVE',
					subtotal: line.subtotal,
					tax: line.tax,
					tax_included: 'YES',
					total: line.total,
					unitary_price: line.unitary,
					unitary_price_meta: line.original
				}
			}]
		}
	});

	if (!quote.quote || !quote.quote.id) {
		throw new Error('Quote creation did not return quote.id: ' + JSON.stringify(quote));
	}

	return apiRequest('/quote_info.php?id=' + encodeURIComponent(quote.quote.id), { bearer });
}

async function ftPayOrderCash(order, client, bearer, payAmount) {
	const total = Number(order.total);
	const received = payAmount === undefined ? total : Number(payAmount);
	const paymentInfo = await apiRequest('/payment_info.php', {
		method: 'POST',
		bearer,
		body: {
			movements: [
				{
					bank_movement: {
						transaction_type: 'CASH',
						client_user_id: client ? client.id : null,
						total: received,
						amount_received: received,
						currency_id: order.currency_id || facturaTruncadoConfig.currencyId,
						exchange_rate: 1,
						status: 'ACTIVE',
						type: 'income'
					},
					bank_movement_orders: [
						{
							currency_amount: received,
							amount: received,
							currency_id: order.currency_id || facturaTruncadoConfig.currencyId,
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
				payment_amount: received,
				received_amount: received,
				change_amount: 0,
				currency_id: order.currency_id || facturaTruncadoConfig.currencyId,
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

async function ftPostOrder(quoteInfo, bearer, orderDiscount) {
	const cfg = facturaTruncadoConfig;
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
				currency_id: cfg.currencyId,
				price_type_id: cfg.priceTypeId,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				paid_status: 'PENDING',
				delivery_status: 'PENDING',
				discount: orderDiscount === undefined ? 0 : orderDiscount,
				tax_percent: cfg.taxPercent,
				total: quoteInfo.items.reduce(function(sum, i) { return sum + Number(i.quote_item.total); }, 0),
				sync_id: cfg.storeId + '-' + Date.now(),
				facturacion_code: '',
				sat_serie: cfg.serie
			},
			items: quoteInfo.items.map(function(i) {
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

	return orderInfo;
}

async function ftCreateOrderFromQuote(quoteInfo, bearer) {
	const orderInfo = await ftPostOrder(quoteInfo, bearer, 0);

	// La orden se paga en efectivo de inmediato: sin pago, closeOrder exige
	// credito al cliente y el cliente de prueba tiene limite 0.
	const paymentInfo = await ftPayOrderCash(orderInfo.order, quoteInfo.client_user, bearer);

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

// Credenciales PAC demo (las del request real del usuario). Cualquiera sirve:
// la sucursal no importa, lo que vale es el articulo al 16%.
const ftDemoPacUser = 'demo1@sicofi.com.mx';
const ftDemoPacPassword = 'demodemoD';

function ftRowHasDemoPac(row) {
	return Object.keys(row).some(function(key) {
		return typeof row[key] === 'string'
			&& row[key].toLowerCase().indexOf(ftDemoPacUser.toLowerCase()) !== -1;
	});
}

// Sucursal: la configurada si esta al 16% DESGLOSADA, si no cualquiera que lo
// este. La sucursal no importa para el caso; el impuesto sale del renglon.
async function ftResolveStore(session, bearer) {
	const cfg = facturaTruncadoConfig;
	const wanted = function(store) {
		return !!store
			&& Number(store.tax_percent) === cfg.taxPercent
			&& store.modo_facturacion === 'DESGLOSADA';
	};

	const direct = await ftGetStore(cfg.storeId, bearer);
	if (wanted(direct)) {
		return direct;
	}

	console.log('Factura truncado: sucursal ' + cfg.storeId + ' no es 16%/DESGLOSADA, buscando otra...');
	const list = await apiRequest('/store.php?limit=-1', { bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.store || r; })
		.filter(function(r) { return r && r.id; });
	const found = rows.find(wanted);

	if (found) {
		console.log('Factura truncado: usando sucursal ' + found.id + ' (' + (found.name || '?') + ')');
		return found;
	}

	throw new Error(
		'No hay sucursal 16% DESGLOSADA (revisadas: '
		+ rows.map(function(r) { return r.id + '/' + r.tax_percent + '/' + r.modo_facturacion; }).join(', ')
		+ ')'
	);
}

// billing_data: hoy solo se timbra a precision 6 (las filas precision 2 no
// las acepta el PAC para este caso). Se prefiere el configurado, luego el
// default de la sucursal, luego uno con usuario PAC demo, luego cualquiera
// existente; si la tabla esta vacia se crea uno con las credenciales demo.
// Cada candidato se verifica con GET porque un id inexistente hace fallar
// datos_facturacion con error generico.
async function ftResolveBillingDataId(store, bearer) {
	const cfg = facturaTruncadoConfig;
	const candidates = [Number(cfg.billingDataId)];

	if (store && store.default_billing_data_id) {
		candidates.push(Number(store.default_billing_data_id));
	}

	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}
		try {
			const response = await apiRequest('/billing_data.php?id=' + encodeURIComponent(candidate), { bearer });
			const row = response.billing_data || response;
			if (row && row.id) {
				if (Number(row.id) !== candidates[0]) {
					console.log('Factura truncado: billing_data preferido no existe, usando ' + row.id);
				}
				return Number(row.id);
			}
		}
		catch (error) {
			// se intenta el siguiente candidato
		}
	}

	const list = await apiRequest('/billing_data.php?limit=-1', { bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.billing_data || r; })
		.filter(function(r) { return r && r.id; });

	console.log(
		'Factura truncado: billing_data disponibles '
		+ rows.map(function(r) { return r.id + '/' + (r.rfc || '?') + '/' + (r.regimen_fiscal || '?'); }).join(', ')
	);

	const demo = rows.find(ftRowHasDemoPac);
	if (demo) {
		console.log('Factura truncado: usando billing_data ' + demo.id + ' (usuario PAC demo)');
		return Number(demo.id);
	}

	const rfcMatch = store && store.rfc
		? rows.find(function(r) { return r.rfc === store.rfc; })
		: null;
	if (rfcMatch) {
		console.log('Factura truncado: usando billing_data ' + rfcMatch.id + ' (RFC de la sucursal)');
		return Number(rfcMatch.id);
	}

	if (rows.length > 0) {
		console.log('Factura truncado: usando billing_data ' + rows[0].id + ' (cualquiera disponible)');
		return Number(rows[0].id);
	}

	return ftCreateDemoBillingData(bearer);
}

// Tabla vacia: clona la estructura minima con las credenciales PAC demo.
// Solo llega aqui si no existe ningun billing_data en el backend.
async function ftCreateDemoBillingData(bearer) {
	const created = await apiRequest('/billing_data.php', {
		method: 'POST',
		bearer,
		body: {
			billing_data: {
				pac_usuario: ftDemoPacUser,
				pac_password: ftDemoPacPassword,
				status: 'ACTIVE'
			}
		}
	});
	const row = created.billing_data || created;

	if (!row || !row.id) {
		throw new Error(
			'No hay billing_data en el backend y la creacion con usuario demo fallo: '
			+ JSON.stringify(created).slice(0, 300)
		);
	}

	console.log('Factura truncado: billing_data creado ' + row.id + ' (usuario PAC demo)');
	return Number(row.id);
}

async function ftFacturar(orderId, billingDataId, bearer, applyRounding) {
	const cfg = facturaTruncadoConfig;

	try {
		await apiRequest('/updates/datos_facturacion.php', {
			method: 'POST',
			bearer,
			body: {
				id: orderId,
				billing_data_id: billingDataId,
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
	}
	catch (error) {
		const snapshot = await apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer });
		throw new Error(
			'datos_facturacion fallo para orden ' + orderId
			+ ' con billing_data ' + billingDataId
			+ ': ' + error.message
			+ ' | orden: ' + JSON.stringify(snapshot.order || snapshot).slice(0, 300)
		);
	}

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
			billing_data_id: billingDataId,
			apply_rounding_discount_adjustment: !!applyRounding
		}
	});

	const result = facturada.order || facturada;

	if (!result.sat_factura_id) {
		throw new Error('Factura was not created: ' + JSON.stringify(facturada).slice(0, 300));
	}

	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(result.sat_factura_id), { bearer });
}

async function ftFetchXmlText(bearer, attachmentId) {
	const response = await fetch(endpoint() + '/attachment.php?id=' + encodeURIComponent(attachmentId), {
		headers: { Authorization: 'Bearer ' + bearer }
	});

	if (!response.ok) {
		throw new Error('XML fetch failed with HTTP ' + response.status);
	}

	return response.text();
}

// Primer atributo de la etiqueta de apertura indicada (con prefijo, p.ej.
// 'cfdi:Comprobante'). Se limita a la apertura para no confundir Total con
// TotalImpuestosTrasladados de los nodos hijos.
function ftXmlAttr(xml, tagName, attrName) {
	const root = xml.match(new RegExp('<' + tagName + '\\b[^>]*>'));
	if (!root) {
		return null;
	}
	const match = root[0].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

function ftConceptoAttr(xml, index, attrName) {
	const tags = xml.match(new RegExp('<cfdi:Concepto\\b[^>]*>', 'g')) || [];
	if (!tags[index]) {
		return null;
	}
	const match = tags[index].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

QUnit.module('Orden y factura al 16%');

// Cuerpo compartido del flujo completo (cotizacion -> orden -> pago -> CFDI)
// con el flag apply_rounding_discount_adjustment indicado. El ideal es que
// ambos respeten el unitario del renglon (100.04): OFF ya lo hace; ON hoy
// deriva 100.05 por ceil en el backend, asi que ese caso falla hasta que el
// backend lo corrija. A precision 6 ambos timbran Total 116.05.
async function ftRunStampCase(assert, applyRounding, expectedUnitaryBase, clientPrefix) {
	const cfg = facturaTruncadoConfig;
	const session = await login();
	assert.ok(session.bearer, 'sesion iniciada');

	const store = await ftResolveStore(session, session.bearer);
	cfg.storeId = Number(store.id);
	assert.equal(Number(store.tax_percent), cfg.taxPercent, 'la sucursal cobra 16% de impuesto');
	assert.equal(store.modo_facturacion, 'DESGLOSADA', 'la sucursal desglosa la factura');

	const billingDataId = await ftResolveBillingDataId(store, session.bearer);
	assert.ok(billingDataId, 'datos de facturacion listos, folio ' + billingDataId);
	const billingRow = await apiRequest('/billing_data.php?id=' + encodeURIComponent(billingDataId), { bearer: session.bearer });
	const billingPrecision = Number((billingRow.billing_data || billingRow).precision);
	assert.equal(billingPrecision, 6, 'la factura usa 6 decimales');
	const expectedUnitario = expectedUnitaryBase.toFixed(billingPrecision);

	const item = await ftResolveItem(session.bearer);
	assert.ok(item.id, 'articulo listo, id ' + item.id);

	const originalQty = await ftStockOf(item.id, cfg.storeId, session.bearer);
	await ftSetStock(item.id, cfg.storeId, originalQty + cfg.line.qty, session.bearer, 'POSTest factura truncado inicio');

	try {
		const client = await ftCreateClient(cfg.storeId, session.bearer, clientPrefix);
		assert.ok(client.id, 'cliente creado, id ' + client.id);

		const quoteInfo = await ftCreateQuote(client, item.id, session.bearer);
		assert.ok(quoteInfo.quote.id, 'cotizacion creada, folio ' + quoteInfo.quote.id);
		assert.deepEqual(
			[ftRound2(quoteInfo.items[0].quote_item.unitary_price), ftRound2(quoteInfo.items[0].quote_item.subtotal), ftRound2(quoteInfo.items[0].quote_item.total)],
			[cfg.line.unitary, cfg.line.subtotal, cfg.line.total],
			'la cotizacion respeta precio 100.04, subtotal 100.04 y total 116.05'
		);

		const orderInfo = await ftCreateOrderFromQuote(quoteInfo, session.bearer);
		assert.ok(orderInfo.order.id, 'orden creada, folio ' + orderInfo.order.id);
		assert.equal(orderInfo.order.status, 'CLOSED', 'orden cerrada');
		assert.ok(orderInfo.payment_id, 'orden pagada en efectivo, pago ' + orderInfo.payment_id);

		const satFactura = await ftFacturar(orderInfo.order.id, billingDataId, session.bearer, applyRounding);
		assert.ok(satFactura.uuid, 'factura timbrada, folio fiscal ' + satFactura.uuid);

		const xml = await ftFetchXmlText(session.bearer, satFactura.xml_attachment_id);
		const comprobanteTotal = ftXmlAttr(xml, 'cfdi:Comprobante', 'Total');
		assert.ok(
			Math.abs(Number(comprobanteTotal) - cfg.roundedTotal) < 1e-9,
			'el total de la factura es 116.05, llego ' + comprobanteTotal
		);
		assert.equal(ftXmlAttr(xml, 'cfdi:Comprobante', 'Subtotal'), '100.040000', 'el subtotal de la factura es 100.04');
		assert.equal(ftConceptoAttr(xml, 0, 'ValorUnitario'), expectedUnitario, 'cada pieza se cobra a ' + expectedUnitario);

		console.log(
			'Orden ' + orderInfo.order.id
			+ ' | factura ' + satFactura.id + ' | folio fiscal ' + satFactura.uuid
			+ ' | total ' + comprobanteTotal
		);
	}
	finally {
		await ftSetStock(item.id, cfg.storeId, originalQty, session.bearer, 'POSTest factura truncado restauracion');
	}
}

QUnit.test('Orden y factura para que el subtotal sea 100.04, sin ajuste', async function(assert) {
	assert.timeout(300000);
	assert.expect(16);
	await ftRunStampCase(assert, false, facturaTruncadoConfig.line.unitary, 'POSTest Subtotal 10004');
});

// Arma cotizacion -> orden -> pago en efectivo por el total del renglon,
// sin cerrar ni timbrar. Con lineCash es el caso del cliente que trae
// 116.04: renglon 100.03 + 16.00 autoconsistente, como la orden 175545.
async function ftSetupPaidOrderCase(assert, line, clientPrefix) {
	const cfg = facturaTruncadoConfig;
	const session = await login();
	assert.ok(session.bearer, 'sesion iniciada');

	const store = await ftResolveStore(session, session.bearer);
	cfg.storeId = Number(store.id);
	assert.equal(Number(store.tax_percent), cfg.taxPercent, 'la sucursal cobra 16% de impuesto');

	const item = await ftResolveItem(session.bearer);
	assert.ok(item.id, 'articulo listo, id ' + item.id);

	const originalQty = await ftStockOf(item.id, cfg.storeId, session.bearer);
	await ftSetStock(item.id, cfg.storeId, originalQty + line.qty, session.bearer, 'POSTest factura 116.04 inicio');

	const client = await ftCreateClient(cfg.storeId, session.bearer, clientPrefix);
	assert.ok(client.id, 'cliente creado, id ' + client.id);

	const quoteInfo = await ftCreateQuote(client, item.id, session.bearer, line);
	assert.ok(quoteInfo.quote.id, 'cotizacion creada, folio ' + quoteInfo.quote.id);

	const orderInfo = await ftPostOrder(quoteInfo, session.bearer, 0);
	assert.ok(orderInfo.order.id, 'orden creada, folio ' + orderInfo.order.id);

	const paymentInfo = await ftPayOrderCash(orderInfo.order, client, session.bearer, line.total);
	assert.ok(paymentInfo.payment.id, 'pago en efectivo, folio ' + paymentInfo.payment.id);

	return { session: session, item: item, originalQty: originalQty, orderInfo: orderInfo, paymentInfo: paymentInfo };
}

async function ftCloseOrderCase(orderId, bearer) {
	// El pago que cubre el adeudo ya cierra la orden sola; solo se fuerza el
	// cierre si sigue abierta (cerrar una orden CLOSED falla en updates.php).
	const current = await apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer: bearer });
	if (current.order.status !== 'CLOSED') {
		await apiRequest('/updates.php', {
			method: 'POST',
			bearer: bearer,
			body: { method: 'closeOrder', order_id: orderId }
		});
	}
	return apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer: bearer });
}

QUnit.test('Orden y factura para que el total sea 116.04, con ajuste', async function(assert) {
	assert.timeout(300000);
	assert.expect(15);

	const line = facturaTruncadoConfig.lineCash;
	const flow = await ftSetupPaidOrderCase(assert, line, 'POSTest Total 11604');

	try {
		assert.equal(ftRound2(flow.paymentInfo.payment.received_amount), line.total, 'recibidos 116.04 en efectivo');

		const closed = await ftCloseOrderCase(flow.orderInfo.order.id, flow.session.bearer);
		assert.equal(closed.order.status, 'CLOSED', 'orden cerrada');
		assert.equal(closed.order.paid_status, 'PAID', 'orden pagada con 116.04');
		assert.equal(ftRound2(closed.order.total), line.total, 'el total de la orden es 116.04');

		const item = closed.items[0].order_item;
		assert.deepEqual(
			[ftRound2(item.unitary_price), ftRound2(item.subtotal), ftRound2(item.tax), ftRound2(item.total)],
			[line.unitary, line.subtotal, line.tax, line.total],
			'el renglon es 100.03 mas 16.00'
		);

		const billingDataId = await ftResolveBillingDataId({ id: facturaTruncadoConfig.storeId }, flow.session.bearer);
		assert.ok(billingDataId, 'datos de facturacion listos, folio ' + billingDataId);

		const satFactura = await ftFacturar(flow.orderInfo.order.id, billingDataId, flow.session.bearer, true);
		assert.ok(satFactura.uuid, 'factura timbrada, folio fiscal ' + satFactura.uuid);

		const xml = await ftFetchXmlText(flow.session.bearer, satFactura.xml_attachment_id);
		const comprobanteTotal = ftXmlAttr(xml, 'cfdi:Comprobante', 'Total');
		assert.ok(
			Math.abs(Number(comprobanteTotal) - line.total) < 1e-9,
			'el total de la factura es 116.04, llego ' + comprobanteTotal
		);
	}
	finally {
		await ftSetStock(flow.item.id, facturaTruncadoConfig.storeId, flow.originalQty, flow.session.bearer, 'POSTest factura 116.04 restauracion');
	}
});

