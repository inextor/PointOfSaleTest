// Replica EXACTA de la cotizacion 12349 (sucursal AEROPUERTO, IVA 8% fronterizo):
// los mismos 3 articulos Comex, las mismas cantidades (1 c/u) y los mismos importes
// con IVA incluido que la cotizacion real, hasta el CFDI timbrado.
//
// A diferencia de quote_facturacion.js (16% en CEDIS), aqui SI se replica el 8%
// tal como esta configurada la sucursal de la cotizacion: no se cambia la tasa.
// El impuesto de la orden se toma de la sucursal (store.tax_percent) igual que en
// produccion, y cada renglon viaja con sus valores completos y consistentes para
// que OrderUtils::applyPrice los respete tal cual.
//
// La sucursal se RESUELVE: se reutiliza una que ya este al 8% y, solo si no existe
// ninguna, se crea una nueva con esa tasa. Los articulos se crean (idempotente por
// nombre exacto) con los mismos campos SAT de los articulos reales.
const quoteReplicaTestConfig = {
	sourceQuoteId: 12349,
	// Sucursal de la cotizacion 12349: AEROPUERTO, tax_percent 8, modo DESGLOSADA.
	storeId: 3,
	storeSearchName: 'POSTest Quote Replica 12349 Store',
	taxPercent: 8,
	priceTypeId: 1,
	currencyId: 'MXN',
	serie: 'A',
	// Datos de la sucursal de la cotizacion, usados solo si hay que crearla.
	storeSeed: {
		address: 'BOULEVARD REFORMA 8133, AEROPUERTO',
		businessName: 'HECTOR EDUARDO RODRIGUEZ LLAMAS',
		city: 'ENSENADA',
		phone: '(646)-154-8445',
		rfc: 'ROLH890626D29',
		state: 'BC',
		zipcode: '22785'
	},
	// billing_data autorizado (con credenciales del PAC) que se reutiliza para la
	// factura. Una fila nueva de billing_data no esta autorizada ante el PAC.
	preferredBillingDataId: 2,
	billingDataRfc: 'ROLH890626D29',
	billingDataRegimen: '612',
	receiver: {
		razonSocial: 'Prueba',
		email: 'paogomezc7@gmail.com',
		rfc: 'XAXX010101000',
		domicilioFiscal: '22785',
		regimenFiscal: '616',
		regimenCapital: '616',
		usoCfdi: 'S01'
	},
	// Valores tomados verbatim de la cotizacion 12349 (precio con IVA incluido =
	// original_unitary_price; el resto son los importes guardados por el sistema).
	lines: [
		{
			sourceItemId: 8696,
			name: 'VINIMEX TOTAL ULTRALAVABLE SAT V2 4L',
			code: '0475434',
			claveSat: '31211506',
			unit: 'H87',
			qty: 1,
			original: 1023.5,
			unitary: 947.69,
			subtotal: 947.69,
			tax: 75.82,
			total: 1023.5
		},
		{
			sourceItemId: 7459,
			name: 'SELLADOR ENTINTABLE BLANCO 19L',
			code: '0208130',
			claveSat: '31211704',
			unit: 'H87',
			qty: 1,
			original: 2227,
			unitary: 2062.04,
			subtotal: 2062.04,
			tax: 164.96,
			total: 2227
		},
		{
			sourceItemId: 8079,
			name: 'PRO 1000 PLUS BLANCO 19L',
			code: '0200300',
			claveSat: '31211506',
			unit: 'H87',
			qty: 1,
			original: 2665,
			unitary: 2467.59,
			subtotal: 2467.59,
			tax: 197.41,
			total: 2665
		}
	],
	// Totales de la orden 173620 generada por la cotizacion 12349.
	orderSubtotal: 5477.31,
	orderTax: 438.19,
	orderTotal: 5915.5
};

function qrRound2(n) {
	return Math.round(n * 100) / 100;
}

// Misma formula y mismo orden de redondeo que OrderUtils::applyPrice rama YES
// (tax_included): total -> subtotal -> unitario -> iva.
function qrTaxIncludedLine(original, qty, rate) {
	const total = qrRound2(original * qty);
	const subtotal = qrRound2(total / (1 + rate / 100));
	const unitary = qrRound2(subtotal / qty);
	const tax = qrRound2(subtotal * (rate / 100));
	return { unitary, subtotal, tax, total };
}

function qrSameMoney(actual, expected) {
	return qrRound2(Number(actual)) === qrRound2(Number(expected));
}

function qrNumericStoreId(session) {
	const fromSession = Number(session.user && session.user.store_id);
	return fromSession > 0 ? fromSession : quoteReplicaTestConfig.storeId;
}

async function qrGetStore(storeId, bearer) {
	const response = await apiRequest('/store.php?id=' + encodeURIComponent(storeId), { bearer });
	return response.store || response;
}

async function qrFindStoreByName(name, bearer) {
	const response = await apiRequest('/store.php?name=' + encodeURIComponent(name), { bearer });
	const rows = response.data || response.result || [];
	const row = rows.find(function(r) {
		const store = r.store || r;
		return store.name === name;
	});
	return row ? (row.store || row) : null;
}

function qrStoreMatches(store) {
	return !!store
		&& Number(store.id) > 0
		&& Number(store.tax_percent) === quoteReplicaTestConfig.taxPercent
		&& store.modo_facturacion === 'DESGLOSADA';
}

// Resuelve la sucursal al 8%: reutiliza la de la cotizacion (o la del usuario) y
// solo crea una nueva si ninguna existe con esa tasa.
async function qrResolveStore(session, bearer) {
	const cfg = quoteReplicaTestConfig;
	const candidates = [cfg.storeId, qrNumericStoreId(session)];

	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}
		const store = await qrGetStore(candidate, bearer);
		if (qrStoreMatches(store)) {
			return store;
		}
	}

	const existing = await qrFindStoreByName(cfg.storeSearchName, bearer);
	if (qrStoreMatches(existing)) {
		return existing;
	}

	const billingDataId = await qrResolveBillingDataId(null, bearer);
	const created = await apiRequest('/store.php', {
		method: 'POST',
		bearer,
		body: {
			address: cfg.storeSeed.address,
			business_name: cfg.storeSeed.businessName,
			city: cfg.storeSeed.city,
			code: 'QR' + Date.now(),
			default_billing_data_id: billingDataId,
			default_currency_id: cfg.currencyId,
			default_sat_serie: cfg.serie,
			exchange_rate: 1,
			max_cash_amount: 12000,
			modo_facturacion: 'DESGLOSADA',
			name: cfg.storeSearchName,
			phone: cfg.storeSeed.phone,
			pos_category_preferences: 'DEFAULT_BY_PRODUCT',
			pos_online_preferences: 'SHOW_BY_DEFAULT',
			price_list_id: null,
			production_enabled: 0,
			rfc: cfg.storeSeed.rfc,
			sales_enabled: 1,
			show_facturacion_qr: 'NO',
			state: cfg.storeSeed.state,
			status: 'ACTIVE',
			suggested_tip: 0,
			tax_percent: cfg.taxPercent,
			zipcode: cfg.storeSeed.zipcode
		}
	});

	const store = created.store || created;

	if (!qrStoreMatches(store)) {
		throw new Error(
			'No se pudo resolver una sucursal al ' + cfg.taxPercent + '% DESGLOSADA. Respuesta: '
			+ JSON.stringify(created).slice(0, 300)
		);
	}

	return store;
}

// Reutiliza un billing_data autorizado: el default de la sucursal, el preferido o
// cualquiera con el RFC del emisor. Nunca se crea uno nuevo (no tendria credenciales PAC).
async function qrResolveBillingDataId(store, bearer) {
	const cfg = quoteReplicaTestConfig;
	const candidates = [];

	if (store && store.default_billing_data_id) {
		candidates.push(Number(store.default_billing_data_id));
	}
	candidates.push(Number(cfg.preferredBillingDataId));

	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}
		try {
			const response = await apiRequest('/billing_data.php?id=' + encodeURIComponent(candidate), { bearer });
			const row = response.billing_data || response;
			if (row && row.id) {
				return Number(row.id);
			}
		}
		catch (error) {
			// se intenta el siguiente candidato
		}
	}

	const response = await apiRequest('/billing_data.php?limit=-1', { bearer });
	const rows = response.data || response.result || [];
	const row = rows
		.map(function(r) { return r.billing_data || r; })
		.find(function(r) {
			return r && r.id && (r.rfc === cfg.billingDataRfc || r.regimen_fiscal === cfg.billingDataRegimen);
		});

	if (row) {
		return Number(row.id);
	}

	throw new Error('No se encontro un billing_data autorizado para facturar (revisar billing_data.php)');
}

async function qrStockOf(itemId, storeId, bearer) {
	const response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer }
	);
	const rows = response.data || [];
	return rows.length && rows[0].stock_record ? Number(rows[0].stock_record.qty) : 0;
}

async function qrSetStock(itemId, storeId, qty, bearer, comment) {
	await apiRequest('/updates/stock_adjust.php', {
		method: 'POST',
		bearer,
		body: [{
			comment: comment || 'POSTest quote replica 12349',
			item_id: itemId,
			qty: qty,
			skip_merma: true,
			store_id: storeId
		}]
	});
}

// Precio explicito (price_list 1 / price_type 1 / MXN) como en subscription.js, para
// que el articulo sea vendible y pagable tambien desde el POS con el precio de la
// cotizacion. Idempotente: se reutiliza la fila existente con ese mismo precio.
async function qrEnsurePrice(bearer, itemId, price) {
	const cfg = quoteReplicaTestConfig;
	const search = await apiRequest(
		'/price.php?item_id=' + encodeURIComponent(itemId)
		+ '&price_list_id=1&price_type_id=' + cfg.priceTypeId,
		{ bearer }
	);
	const rows = (search.data || search.result || []).map(function(r) { return r.price || r; });
	const existing = rows.find(function(r) {
		return r && r.price !== undefined && qrSameMoney(r.price, price);
	});

	if (existing) {
		return existing;
	}

	return apiRequest('/price.php', {
		method: 'POST',
		bearer,
		body: {
			currency_id: cfg.currencyId,
			item_id: itemId,
			percent: 0,
			price: price,
			price_list_id: 1,
			price_type_id: cfg.priceTypeId,
			tax_included: 'YES'
		}
	});
}

// Crea (o reutiliza por nombre exacto) los articulos con los mismos campos que los
// articulos reales de la cotizacion: applicable_tax DEFAULT, tax_percent 0, H87.
async function qrResolveItems(bearer, storeId, lines) {
	const resolved = [];

	for (const line of lines) {
		const item = await getOrCreateItem(bearer, {
			applicable_tax: 'DEFAULT',
			availability_type: 'ON_STOCK',
			clave_sat: line.claveSat,
			code: line.code,
			currency_id: quoteReplicaTestConfig.currencyId,
			measurement_unit: 'Pieza',
			name: line.name,
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: line.unitary,
			return_action: 'RETURN_TO_STOCK',
			status: 'ACTIVE',
			tax_percent: 0,
			unidad_medida_sat_id: line.unit
		});

		await qrEnsurePrice(bearer, item.id, line.total);

		resolved.push({
			id: item.id,
			item: item,
			line: line,
			storeId: storeId
		});
	}

	return resolved;
}

async function qrCreateClient(storeId, bearer, tag) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName('POSTest Quote Replica 12349 ' + tag),
			phone: '0000',
			price_type_id: quoteReplicaTestConfig.priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Client creation did not return an id: ' + JSON.stringify(client));
	}

	return client;
}

async function qrCreateQuote(client, resolvedItems, store, bearer, tag) {
	const cfg = quoteReplicaTestConfig;
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
				note: 'POSTest replica exacta cotizacion ' + cfg.sourceQuoteId + ' ' + tag,
				phone: '0000',
				price_type_id: cfg.priceTypeId,
				store_id: store.id,
				sync_id: store.id + '-' + Date.now(),
				tax_percent: cfg.taxPercent,
				valid_until: validUntil.toISOString().slice(0, 10)
			},
			items: resolvedItems.map(function(entry) {
				const line = entry.line;
				return {
					quote_item: {
						discount: 0,
						discount_percent: 0,
						item_group: 0,
						item_id: entry.id,
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
						unitary_price: line.unitary
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

async function qrPayOrderCash(order, client, bearer) {
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
						currency_id: order.currency_id || quoteReplicaTestConfig.currencyId,
						exchange_rate: 1,
						status: 'ACTIVE',
						type: 'income'
					},
					bank_movement_orders: [
						{
							currency_amount: total,
							amount: total,
							currency_id: order.currency_id || quoteReplicaTestConfig.currencyId,
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
				currency_id: order.currency_id || quoteReplicaTestConfig.currencyId,
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

async function qrCreateOrderFromQuote(quoteInfo, resolvedItems, store, bearer, tag) {
	const cfg = quoteReplicaTestConfig;
	const group = Date.now();

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer,
		body: {
			order: {
				quote_id: quoteInfo.quote.id,
				store_id: store.id,
				cashier_user_id: quoteInfo.quote.created_by_user_id,
				client_name: 'POSTest Quote Replica ' + cfg.sourceQuoteId + ' ' + tag,
				client_user_id: quoteInfo.quote.client_user_id,
				currency_id: cfg.currencyId,
				price_type_id: cfg.priceTypeId,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				paid_status: 'PENDING',
				delivery_status: 'PENDING',
				discount: 0,
				tax_percent: cfg.taxPercent,
				total: quoteInfo.items.reduce(function(sum, i) { return sum + Number(i.quote_item.total); }, 0),
				sync_id: store.id + '-' + Date.now(),
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
						unitary_price_meta: qi.unitary_price_meta !== undefined ? qi.unitary_price_meta : qi.original_unitary_price
					}
				};
			})
		}
	});

	if (!orderInfo.order || !orderInfo.order.id) {
		throw new Error('Order creation did not return order.id: ' + JSON.stringify(orderInfo));
	}

	// La orden se paga en efectivo de inmediato: sin pago, closeOrder exige credito
	// al cliente y el cliente de prueba tiene limite 0. El pago total suele cerrar
	// la orden solo; solo se cierra explicito si sigue abierta.
	const paymentInfo = await qrPayOrderCash(orderInfo.order, quoteInfo.client_user, bearer);

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

// Deja la orden y el CFDI a proposito para poder revisarlos en la interfaz
// (misma convencion que las pruebas de facturacion recientes).
// applyRoundingAdjustment es el flag "Facturar por el total exacto del ticket":
//   false -> se respeta el subtotal/unitario del renglon de la cotizacion.
//   true  -> se ajusta base/descuento para cuadrar el total exacto de la orden.
async function qrFacturar(orderId, billingDataId, bearer, applyRoundingAdjustment) {
	const cfg = quoteReplicaTestConfig;

	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer,
		body: {
			id: orderId,
			billing_data_id: billingDataId,
			sat_codigo_postal: cfg.receiver.domicilioFiscal,
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
			billing_data_id: billingDataId,
			apply_rounding_discount_adjustment: !!applyRoundingAdjustment
		}
	});

	const result = facturada.order || facturada;

	if (!result.sat_factura_id) {
		throw new Error('Factura was not created: ' + JSON.stringify(facturada).slice(0, 300));
	}

	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(result.sat_factura_id), { bearer });
}

async function qrFetchXmlText(bearer, attachmentId) {
	const response = await fetch(endpoint() + '/attachment.php?id=' + encodeURIComponent(attachmentId), {
		headers: { Authorization: 'Bearer ' + bearer }
	});

	if (!response.ok) {
		throw new Error('XML fetch failed with HTTP ' + response.status);
	}

	return response.text();
}

// Devuelve el primer atributo de la primera etiqueta con ese nombre (usar el nombre
// con prefijo, p.ej. 'cfdi:Comprobante'). Se limita a la etiqueta de apertura para
// no confundir Total con, por ejemplo, TotalImpuestosTrasladados de los nodos hijos.
function qrXmlAttr(xml, tagName, attrName) {
	const root = xml.match(new RegExp('<' + tagName + '\\b[^>]*>'));
	if (!root) {
		return null;
	}
	const match = root[0].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

// Devuelve el atributo del concepto (renglon) en la posicion indicada.
function qrConceptoAttr(xml, index, attrName) {
	const tags = xml.match(new RegExp('<cfdi:Concepto\\b[^>]*>', 'g')) || [];
	if (!tags[index]) {
		return null;
	}
	const match = tags[index].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

// Suma los Importe de todos los conceptos del CFDI.
function qrSumXmlConceptos(xml) {
	const tags = xml.match(new RegExp('<cfdi:Concepto\\b[^>]*>', 'g')) || [];
	const total = tags.reduce(function(sum, tag) {
		const match = tag.match(/\bImporte="([^"]*)"/);
		return sum + (match ? Number(match[1]) : 0);
	}, 0);
	return qrRound2(total);
}

QUnit.module('Quote replica 12349');

QUnit.test('formula local reproduce los renglones de la cotizacion 12349', function(assert) {
	assert.expect(4);

	const cfg = quoteReplicaTestConfig;
	let sum = 0;

	cfg.lines.forEach(function(line, index) {
		const expected = qrTaxIncludedLine(line.original, line.qty, cfg.taxPercent);
		assert.deepEqual(
			[expected.unitary, expected.subtotal, expected.tax, expected.total],
			[line.unitary, line.subtotal, line.tax, line.total],
			'formula local ancla renglon ' + (index + 1) + ' de la cotizacion 12349'
		);
		sum += line.total;
	});

	assert.equal(qrRound2(sum), cfg.orderTotal, 'suma de renglones igual al total de la orden 5915.50');
});

// Cuerpo compartido: replica la cotizacion 12349 completa (cotizacion -> orden ->
// pago -> CFDI) con el flag apply_rounding_discount_adjustment indicado, para poder
// facturar exactamente el mismo flujo DOS veces: con el flag y sin el flag.
// El flag lo interpreta facturacion_request.php -> OrderUtils::facturarOrderISR ->
// Factura4_0::getBaseIVAIEPSISR:
//   apagado: respeta el subtotal/unitario del renglon (los de la cotizacion).
//   prendido: ajusta base/descuento para cuadrar el total exacto del ticket.
async function qrRunReplicaFlow(assert, applyRoundingAdjustment) {
	const cfg = quoteReplicaTestConfig;
	const tag = applyRoundingAdjustment ? 'ON' : 'OFF';
	const session = await login();
	assert.ok(session.bearer, 'logged in (' + tag + ')');

	const store = await qrResolveStore(session, session.bearer);
	assert.ok(store.id, 'sucursal resuelta ' + store.id + ' (' + store.name + ') (' + tag + ')');
	assert.equal(Number(store.tax_percent), cfg.taxPercent, 'sucursal al 8% igual que la cotizacion 12349 (' + tag + ')');
	assert.equal(store.modo_facturacion, 'DESGLOSADA', 'sucursal con facturacion desglosada (' + tag + ')');

	const billingDataId = await qrResolveBillingDataId(store, session.bearer);
	assert.ok(billingDataId, 'billing_data autorizado para facturar ' + billingDataId + ' (' + tag + ')');

	const resolvedItems = await qrResolveItems(session.bearer, store.id, cfg.lines);
	assert.equal(resolvedItems.length, cfg.lines.length, 'articulos creados/reutilizados: ' + cfg.lines.length + ' (' + tag + ')');

	resolvedItems.forEach(function(entry, index) {
		assert.ok(entry.id, 'articulo renglon ' + (index + 1) + ' id ' + entry.id + ' (' + tag + ')');
		assert.equal(entry.item.clave_sat, entry.line.claveSat, 'clave_sat renglon ' + (index + 1) + ' (' + tag + ')');
		assert.equal(entry.item.unidad_medida_sat_id, entry.line.unit, 'unidad SAT renglon ' + (index + 1) + ' (' + tag + ')');
		assert.equal(entry.item.applicable_tax, 'DEFAULT', 'applicable_tax renglon ' + (index + 1) + ' (' + tag + ')');
	});

	const originals = {};
	for (const entry of resolvedItems) {
		originals[entry.id] = await qrStockOf(entry.id, store.id, session.bearer);
	}
	for (const entry of resolvedItems) {
		await qrSetStock(entry.id, store.id, originals[entry.id] + entry.line.qty, session.bearer, 'POSTest quote replica 12349 ' + tag + ' inicio');
	}

	try {
		const client = await qrCreateClient(store.id, session.bearer, tag);
		assert.ok(client.id, 'cliente de prueba creado ' + client.id + ' (' + tag + ')');

		const quoteInfo = await qrCreateQuote(client, resolvedItems, store, session.bearer, tag);
		const quoteId = quoteInfo.quote.id;
		assert.ok(quoteId, 'cotizacion creada ' + quoteId + ' (' + tag + ')');
		assert.equal(quoteInfo.quote.approved_status, 'PENDING', 'cotizacion en PENDING (' + tag + ')');
		assert.equal(Number(quoteInfo.quote.tax_percent), cfg.taxPercent, 'cotizacion al 8% (' + tag + ')');
		assert.equal(Number(quoteInfo.quote.store_id), Number(store.id), 'cotizacion en la sucursal resuelta (' + tag + ')');

		quoteInfo.items.forEach(function(itemInfo, index) {
			const qi = itemInfo.quote_item;
			const line = cfg.lines[index];
			assert.equal(qi.tax_included, 'YES', 'renglon ' + (index + 1) + ' con IVA incluido (' + tag + ')');
			assert.deepEqual(
				[qrRound2(qi.unitary_price), qrRound2(qi.subtotal), qrRound2(qi.tax), qrRound2(qi.total)],
				[line.unitary, line.subtotal, line.tax, line.total],
				'cotizacion conserva importes exactos renglon ' + (index + 1) + ' (' + tag + ')'
			);
		});

		const orderInfo = await qrCreateOrderFromQuote(quoteInfo, resolvedItems, store, session.bearer, tag);
		const orderId = orderInfo.order.id;
		assert.ok(orderId, 'orden creada ' + orderId + ' (' + tag + ')');
		assert.ok(orderInfo.payment_id, 'orden pagada en efectivo ' + orderInfo.payment_id + ' (' + tag + ')');
		assert.equal(orderInfo.order.status, 'CLOSED', 'orden cerrada (' + tag + ')');
		assert.equal(Number(orderInfo.order.tax_percent), cfg.taxPercent, 'orden al 8% (' + tag + ')');
		assert.ok(qrSameMoney(orderInfo.order.total, cfg.orderTotal), 'orden con total 5915.50 (' + tag + ')');

		orderInfo.items.forEach(function(itemInfo, index) {
			const orderItem = itemInfo.order_item;
			const qi = quoteInfo.items[index].quote_item;
			assert.deepEqual(
				[qrRound2(orderItem.unitary_price), qrRound2(orderItem.subtotal), qrRound2(orderItem.tax), qrRound2(orderItem.total)],
				[qrRound2(qi.unitary_price), qrRound2(qi.subtotal), qrRound2(qi.tax), qrRound2(qi.total)],
				'orden hereda valores exactos de la cotizacion renglon ' + (index + 1) + ' (' + tag + ')'
			);
		});

		const satFactura = await qrFacturar(orderId, billingDataId, session.bearer, applyRoundingAdjustment);
		assert.ok(satFactura.uuid, 'CFDI timbrado con flag ' + tag + ' ' + satFactura.uuid);
		assert.equal(satFactura.type, 'NORMAL', 'sat_factura NORMAL (' + tag + ')');

		const xml = await qrFetchXmlText(session.bearer, satFactura.xml_attachment_id);
		const comprobanteTotal = qrXmlAttr(xml, 'cfdi:Comprobante', 'Total');
		const conceptosSum = qrSumXmlConceptos(xml);

		// El total del comprobante es el mismo total exacto de la orden en los dos modos.
		assert.equal(comprobanteTotal, '5915.50', 'comprobante con total exacto 5915.50 con flag ' + tag);

		if (applyRoundingAdjustment) {
			// Con el flag prendido la factura cuadra por base/descuento: el importe del
			// renglon puede ya no ser exactamente el de la cotizacion, por eso aqui no
			// se exige el unitario de la cotizacion.
			console.log(
				'Quote replica 12349 ON -> suma de conceptos ' + conceptosSum
				+ ' | descuento de ajuste en el CFDI: ' + qrXmlAttr(xml, 'cfdi:Concepto', 'Descuento')
			);
		}
		else {
			// Sin el flag se respeta el subtotal/unitario del renglon, los mismos de la
			// cotizacion (947.69 / 2062.04 / 2467.59), y la suma cuadra al centavo.
			assert.equal(qrConceptoAttr(xml, 0, 'ValorUnitario'), '947.69', 'sin flag el XML respeta unitario 947.69 (renglon 1)');
			assert.equal(qrConceptoAttr(xml, 1, 'ValorUnitario'), '2062.04', 'sin flag el XML respeta unitario 2062.04 (renglon 2)');
			assert.equal(qrConceptoAttr(xml, 2, 'ValorUnitario'), '2467.59', 'sin flag el XML respeta unitario 2467.59 (renglon 3)');
			assert.equal(qrConceptoAttr(xml, 0, 'Importe'), '947.69', 'sin flag el XML respeta importe 947.69 (renglon 1)');
			assert.ok(qrSameMoney(conceptosSum, cfg.orderTotal), 'sin flag la suma de conceptos cuadra al centavo con 5915.50');
		}

		// Ids visibles para revisar la cotizacion/orden/factura en la interfaz.
		console.log(
			'Quote replica 12349 flag ' + tag + ' -> COTIZACION ' + quoteId
			+ ' | ORDEN CONSERVADA ' + orderId
			+ ' | FACTURA ' + satFactura.id + ' | UUID ' + satFactura.uuid
			+ ' | Total CFDI ' + comprobanteTotal
		);
	}
	finally {
		for (const entry of resolvedItems) {
			await qrSetStock(entry.id, store.id, originals[entry.id], session.bearer, 'POSTest quote replica 12349 ' + tag + ' restauracion');
		}
	}
}

QUnit.test('cotizacion 12349 SIN flag de ajuste: respeta subtotal y unitario de la cotizacion', async function(assert) {
	assert.timeout(300000);
	await qrRunReplicaFlow(assert, false);
});

QUnit.test('cotizacion 12349 CON flag de ajuste: cuadra el total exacto del ticket', async function(assert) {
	assert.timeout(300000);
	await qrRunReplicaFlow(assert, true);
});
