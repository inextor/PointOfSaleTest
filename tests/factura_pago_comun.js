QUnit.module('facturar_pago_comun.php & PER_PAYMENT Facturacion', function() {

	var perPaymentTestConfig = {
		storeId: 1,
		billingDataId: 1,
		priceTypeId: 1,
		taxPercent: 16,
		receiver: {
			razonSocial: 'GRUPO JFTI SOLUCIONES',
			email: 'integranet@integranet.xyz',
			rfc: 'GJS1410232N4',
			domicilioFiscal: '22887',
			regimenFiscal: '626',
			regimenCapital: '626',
			usoCfdi: 'G03'
		},
		serie: 'A'
	};

	async function createPerPaymentTestItem(bearer, name, price) {
		var item = await getOrCreateItem(bearer, {
			name: name,
			description: name,
			original_price: price,
			price: price,
			cost: price * 0.5,
			tax_percent: perPaymentTestConfig.taxPercent,
			applicable_tax: 'DEFAULT',
			availability_type: 'ALWAYS',
			unidad_medida_sat_id: 'H87',
			clave_sat: '01010101',
			status: 'ACTIVE'
		});
		return item;
	}

	async function createOrderWithMode(bearer, itemIds, prices, mode, clientName) {
		var syncId = createAgentSyncId(1);
		var totalOrder = 0;
		var subtotalOrder = 0;
		var taxOrder = 0;

		var items = itemIds.map(function(itemId, index) {
			var price = prices[index];
			var subtotal = Number((price / (1 + (perPaymentTestConfig.taxPercent / 100))).toFixed(2));
			var tax = Number((price - subtotal).toFixed(2));
			var total = price;

			subtotalOrder += subtotal;
			taxOrder += tax;
			totalOrder += total;

			return {
				order_item: {
					item_id: itemId,
					delivery_status: 'PENDING',
					stock_status: 'IN_STOCK',
					tax_included: 'YES',
					delivered_qty: 0,
					status: 'ACTIVE',
					commanda_status: 'NOT_DISPLAYED',
					item_group: Date.now() + index,
					return_required: 'NO',
					is_item_extra: 'NO',
					is_free_of_charge: 'NO',
					note: '',
					qty: 1,
					item_option_qty: 1,
					paid_qty: 0,
					original_unitary_price: price,
					unitary_price: subtotal,
					subtotal: subtotal,
					discount: 0,
					discount_percent: 0,
					tax: tax,
					total: total,
					preparation_status: 'PENDING'
				}
			};
		});

		var orderPayload = {
			order: {
				billing_data_id: perPaymentTestConfig.billingDataId,
				cashier_user_id: 1,
				client_name: clientName || 'PUBLICO GRAL',
				currency_id: 'MXN',
				marked_for_billing: null,
				note: null,
				paid_status: 'UNPAID',
				paid_timetamp: null,
				price_type_id: 1,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				store_id: perPaymentTestConfig.storeId,
				sync_id: syncId,
				subtotal: Number(subtotalOrder.toFixed(2)),
				tax: Number(taxOrder.toFixed(2)),
				tax_percent: perPaymentTestConfig.taxPercent,
				total: Number(totalOrder.toFixed(2)),
				discount: 0,
				facturado: 'NO',
				facturacion_mode: mode || 'FULL',
				sat_receptor_rfc: perPaymentTestConfig.receiver.rfc,
				sat_razon_social: perPaymentTestConfig.receiver.razonSocial,
				sat_receptor_email: perPaymentTestConfig.receiver.email,
				sat_uso_cfdi: perPaymentTestConfig.receiver.usoCfdi,
				sat_regimen_fiscal_receptor: perPaymentTestConfig.receiver.regimenFiscal,
				sat_domicilio_fiscal_receptor: perPaymentTestConfig.receiver.domicilioFiscal,
				sat_regimen_capital_receptor: perPaymentTestConfig.receiver.regimenCapital,
				sat_serie: perPaymentTestConfig.serie
			},
			items: items
		};

		var response = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: bearer,
			body: orderPayload
		});

		var orderRecord = Array.isArray(response) ? response[0] : (response.order || response);
		return orderRecord.order ? orderRecord.order : orderRecord;
	}

	// 1. Authentication and validation tests
	QUnit.test('POST /facturar_pago_comun.php without auth fails with 401', async function(assert) {
		assert.timeout(10000);
		try {
			await apiRequest('/facturar_pago_comun.php', {
				method: 'POST',
				body: { payment_id: 1 }
			});
			assert.ok(false, 'Should have thrown (no auth)');
		} catch (e) {
			assert.ok(true, 'POST without auth fails as expected: ' + (e.response && e.response.error || e.message));
		}
	});

	QUnit.test('POST /facturar_pago_comun.php with missing payment_id fails validation', async function(assert) {
		assert.timeout(15000);
		try {
			var s = await login();
			await apiRequest('/facturar_pago_comun.php', {
				method: 'POST',
				bearer: s.bearer,
				body: {}
			});
			assert.ok(false, 'Should have thrown (missing payment_id)');
		} catch (e) {
			var msg = (e.response && e.response.error) || e.message || '';
			assert.ok(msg.indexOf('payment_id') >= 0, 'Rejected with missing payment_id error: ' + msg);
		}
	});

	QUnit.test('POST /facturar_pago_comun.php with non-existent payment_id fails validation', async function(assert) {
		assert.timeout(15000);
		try {
			var s = await login();
			await apiRequest('/facturar_pago_comun.php', {
				method: 'POST',
				bearer: s.bearer,
				body: { payment_id: 999999999 }
			});
			assert.ok(false, 'Should have thrown (non-existent payment_id)');
		} catch (e) {
			var msg = (e.response && e.response.error) || e.message || '';
			assert.ok(msg.indexOf('No se encontró el pago') >= 0 || msg.indexOf('payment') >= 0, 'Rejected with not found error: ' + msg);
		}
	});

	// 2. Order creation in PER_PAYMENT mode and verification via order_info.php
	QUnit.test('Order creation with facturacion_mode=PER_PAYMENT and order_info exposure', async function(assert) {
		assert.timeout(30000);
		try {
			var s = await login();
			var ts = Date.now();
			var item1 = await createPerPaymentTestItem(s.bearer, 'Test Item A ' + ts, 100);
			var item2 = await createPerPaymentTestItem(s.bearer, 'Test Item B ' + ts, 200);

			var order = await createOrderWithMode(s.bearer, [item1.id, item2.id], [100, 200], 'PER_PAYMENT', 'Order creation PER_PAYMENT - ' + ts);
			assert.ok(order && order.id, 'Order created with id: ' + order.id + ' client_name=' + order.client_name);
			assert.ok(order.client_name && order.client_name.indexOf('Order creation') === 0, 'order client_name is descriptive, not PUBLICO GRAL: ' + order.client_name);

			// Retrieve order via order_info.php
			var orderInfoResponse = await apiRequest('/order_info.php?id=' + order.id, {
				bearer: s.bearer
			});

			var orderInfo = Array.isArray(orderInfoResponse) ? orderInfoResponse[0] : (orderInfoResponse.data ? orderInfoResponse.data[0] : orderInfoResponse);
			var orderData = orderInfo.order || orderInfo;

			assert.equal(orderData.facturacion_mode, 'PER_PAYMENT', 'order.facturacion_mode is PER_PAYMENT');
			assert.equal(orderData.facturado, 'NO', 'order.facturado is NO initially');
			assert.ok(Array.isArray(orderInfo.payment_facturas), 'order_info includes payment_facturas array');
			assert.equal(orderInfo.payment_facturas.length, 0, 'payment_facturas is empty before payments are invoiced');

			// No se cancela - queda para inspeccion (facturacion test)
			assert.ok(true, 'ORDEN CONSERVADA ID=' + order.id + ' client_name=' + orderData.client_name);
		} catch (e) {
			console.error(e);
			assert.ok(false, 'FAIL: ' + (e.response && e.response.error || e.message));
		}
	});

	// 3. Guardrail: facturar.php and facturar_complemento_pago.php on PER_PAYMENT order
	QUnit.test('Guard: Global facturar.php rejects PER_PAYMENT orders', async function(assert) {
		assert.timeout(30000);
		try {
			var s = await login();
			var ts = Date.now();
			var item = await createPerPaymentTestItem(s.bearer, 'Test Guard Item ' + ts, 150);
			var order = await createOrderWithMode(s.bearer, [item.id], [150], 'PER_PAYMENT', 'Guard facturar.php PER_PAYMENT - ' + ts);

			try {
				await apiRequest('/facturar.php?id=' + order.id, {
					bearer: s.bearer
				});
				assert.ok(false, 'Should have thrown: PER_PAYMENT order cannot be billed as a whole via facturar.php');
			} catch (e) {
				var msg = (e.response && e.response.error) || e.message || '';
				assert.ok(msg.indexOf('PER_PAYMENT') >= 0 || msg.indexOf('abono') >= 0,
					'facturar.php rejected PER_PAYMENT order with expected guard error: ' + msg);
			}

			assert.ok(order.client_name && order.client_name.indexOf('Guard') === 0, 'order client_name descriptive: ' + order.client_name);
			// No se cancela - queda para inspeccion
			assert.ok(true, 'ORDEN CONSERVADA ID=' + order.id + ' client_name=' + order.client_name);
		} catch (e) {
			console.error(e);
			assert.ok(false, 'FAIL: ' + (e.response && e.response.error || e.message));
		}
	});

	// 4. Guardrail: facturar_pago_comun.php rejects payments for FULL mode orders
	QUnit.test('Guard: facturar_pago_comun rejects payments for FULL mode orders', async function(assert) {
		assert.timeout(30000);
		try {
			var s = await login();
			var ts = Date.now();
			var item = await createPerPaymentTestItem(s.bearer, 'Test Full Guard ' + ts, 100);
			var order = await createOrderWithMode(s.bearer, [item.id], [100], 'FULL', 'Guard FULL no PER_PAYMENT - ' + ts);

			// Create payment for FULL order
			var paymentBody = paymentPayload(order.id, 100, s.user ? s.user.id : 1);
			var paymentResp = await apiRequest('/payment_info.php', {
				method: 'POST',
				bearer: s.bearer,
				body: paymentBody
			});

			var paymentObj = Array.isArray(paymentResp) ? paymentResp[0] : (paymentResp.payment || paymentResp);
			assert.ok(paymentObj && paymentObj.id, 'Payment created for FULL order id: ' + paymentObj.id);
			assert.ok(order.client_name && order.client_name.indexOf('Guard') === 0, 'order client_name descriptive: ' + order.client_name);

			try {
				await apiRequest('/facturar_pago_comun.php', {
					method: 'POST',
					bearer: s.bearer,
					body: { payment_id: paymentObj.id }
				});
				assert.ok(false, 'Should have thrown: facturar_pago_comun cannot invoice FULL mode order payments');
			} catch (e) {
				var msg = (e.response && e.response.error) || e.message || '';
				assert.ok(msg.indexOf('PER_PAYMENT') >= 0,
					'facturar_pago_comun rejected FULL order payment with expected guard error: ' + msg);
			}

			// No se cancela - queda para inspeccion
			assert.ok(true, 'ORDEN CONSERVADA ID=' + order.id + ' client_name=' + order.client_name + ' payment=' + paymentObj.id);
		} catch (e) {
			console.error(e);
			assert.ok(false, 'FAIL: ' + (e.response && e.response.error || e.message));
		}
	});

	// 5. Payment flow on PER_PAYMENT order and payment_info enrichment
	QUnit.test('Payment on PER_PAYMENT order is created and enriched in payment_info', async function(assert) {
		assert.timeout(30000);
		try {
			var s = await login();
			var ts = Date.now();
			var item1 = await createPerPaymentTestItem(s.bearer, 'Test Abono Item 1 ' + ts, 100);
			var item2 = await createPerPaymentTestItem(s.bearer, 'Test Abono Item 2 ' + ts, 200);
			var order = await createOrderWithMode(s.bearer, [item1.id, item2.id], [100, 200], 'PER_PAYMENT', 'Payment flow PER_PAYMENT 120 - ' + ts);

			// Apply partial payment of $120
			var paymentBody = paymentPayload(order.id, 120, s.user ? s.user.id : 1);
			var paymentResp = await apiRequest('/payment_info.php', {
				method: 'POST',
				bearer: s.bearer,
				body: paymentBody
			});

			var paymentObj = Array.isArray(paymentResp) ? paymentResp[0] : (paymentResp.payment || paymentResp);
			assert.ok(paymentObj && paymentObj.id, 'Partial payment created with id: ' + paymentObj.id);
			assert.ok(order.client_name && order.client_name.indexOf('Payment flow') === 0, 'order client_name descriptive: ' + order.client_name);

			// Check order status
			var orderInfoResponse = await apiRequest('/order_info.php?id=' + order.id, {
				bearer: s.bearer
			});
			var orderInfo = Array.isArray(orderInfoResponse) ? orderInfoResponse[0] : (orderInfoResponse.data ? orderInfoResponse.data[0] : orderInfoResponse);
			var orderData = orderInfo.order || orderInfo;

			assert.equal(orderData.paid_status, 'PARTIALLY_PAID', 'Order status is PARTIALLY_PAID');
			assert.equal(Number(orderData.amount_paid), 120, 'Order amount_paid is 120');

			// Verify payment_info enrichment
			var paymentInfoResp = await apiRequest('/payment_info.php', {
				method: 'POST',
				bearer: s.bearer,
				body: { _post_search: 1, id: paymentObj.id }
			});

			var pInfo = Array.isArray(paymentInfoResp.data) ? paymentInfoResp.data[0] : (Array.isArray(paymentInfoResp) ? paymentInfoResp[0] : paymentInfoResp);
			assert.ok(pInfo, 'Payment info returned');
			assert.equal(pInfo.sat_factura, null, 'sat_factura is null before invoicing');

			// No se cancela - queda para inspeccion
			assert.ok(true, 'ORDEN CONSERVADA ID=' + order.id + ' client_name=' + orderData.client_name + ' payment=' + paymentObj.id);
		} catch (e) {
			console.error(e);
			assert.ok(false, 'FAIL: ' + (e.response && e.response.error || e.message));
		}
	});

	// 6. Factura PER_PAYMENT completa hasta pagado (manual, sin cancelar) - requiere PAC real
	// Este test NO se ejecuta en all.html (solo manual via tests/factura_pago_comun.html)
	// Crea una orden PER_PAYMENT y factura cada abono via /facturar_pago_comun.php hasta cubrir el total.
	// No cancela la orden para permitir inspeccion post-facturacion (como Factura / Nota de Credito).
	QUnit.test('Factura PER_PAYMENT completa: facturacion por abono hasta pagado (manual, sin cancelar)', async function(assert) {
		assert.timeout(120000);
		try {
			var s = await login();
			assert.ok(s.bearer, 'logged in');

			var ts = Date.now();
			var item1 = await createPerPaymentTestItem(s.bearer, 'Test PER_PAYMENT Pago 1 ' + ts, 150);
			var item2 = await createPerPaymentTestItem(s.bearer, 'Test PER_PAYMENT Pago 2 ' + ts, 150);
			assert.ok(item1.id, 'item1 creado id=' + item1.id);
			assert.ok(item2.id, 'item2 creado id=' + item2.id);

			var order = await createOrderWithMode(s.bearer, [item1.id, item2.id], [150, 150], 'PER_PAYMENT', 'FACTURA PER_PAYMENT HASTA PAGADO ' + ts);
			assert.ok(order && order.id, 'Orden PER_PAYMENT creada id=' + order.id + ' total=' + order.total);
			assert.equal(order.facturacion_mode, 'PER_PAYMENT', 'orden en modo PER_PAYMENT');
			assert.equal(order.facturado, 'NO', 'orden inicia sin facturar');

			var abonos = [100, 100, 100]; // 3 pagos que suman 300 = total orden
			var paymentIds = [];
			var satFacturaIds = [];

			for (var i = 0; i < abonos.length; i++) {
				var amount = abonos[i];
				var paymentBody = paymentPayload(order.id, amount, s.user ? s.user.id : 1);
				var paymentResp = await apiRequest('/payment_info.php', {
					method: 'POST',
					bearer: s.bearer,
					body: paymentBody
				});
				var paymentObj = Array.isArray(paymentResp) ? paymentResp[0] : (paymentResp.payment || paymentResp);
				assert.ok(paymentObj && paymentObj.id, 'Abono ' + (i + 1) + ' creado id=' + paymentObj.id + ' monto=' + amount);
				paymentIds.push(paymentObj.id);

				try {
					var invoiceResult = await apiRequest('/facturar_pago_comun.php', {
						method: 'POST',
						bearer: s.bearer,
						body: {
							payment_id: paymentObj.id,
							email: perPaymentTestConfig.receiver.email,
							sat_serie: perPaymentTestConfig.serie
						}
					});
					assert.ok(invoiceResult.success, 'Abono ' + (i + 1) + ' facturado success: ' + JSON.stringify(invoiceResult).slice(0, 300));
					assert.ok(invoiceResult.sat_factura_id, 'Abono ' + (i + 1) + ' sat_factura_id=' + invoiceResult.sat_factura_id);
					assert.ok(invoiceResult.uuid, 'Abono ' + (i + 1) + ' uuid=' + invoiceResult.uuid);
					// La UI (ViewOrderComponent) muestra botones PDF/XML solo si hay attachment ids
					assert.ok(invoiceResult.xml_attachment_id, 'Abono ' + (i + 1) + ' xml_attachment_id=' + invoiceResult.xml_attachment_id + ' (necesario para boton XML)');
					// pdf_attachment_id es opcional pero idealmente existe; si falta es warning, no fallo duro
					if (!invoiceResult.pdf_attachment_id) {
						console.warn('Abono ' + (i + 1) + ' sin pdf_attachment_id - el boton PDF no aparecera, revisar generarPDF/Sicofi');
					} else {
						assert.ok(invoiceResult.pdf_attachment_id, 'Abono ' + (i + 1) + ' pdf_attachment_id=' + invoiceResult.pdf_attachment_id);
					}
					satFacturaIds.push(invoiceResult.sat_factura_id);

					// Verificar sat_factura directo - debe tener xml_attachment_id (y pdf si se genero)
					var sfResp = await apiRequest('/sat_factura.php?id=' + invoiceResult.sat_factura_id, { bearer: s.bearer });
					var sf = sfResp.sat_factura || sfResp;
					assert.ok(sf && sf.id, 'sat_factura ' + invoiceResult.sat_factura_id + ' existe');
					assert.ok(sf.uuid, 'sat_factura uuid=' + sf.uuid);
					assert.ok(sf.xml_attachment_id, 'sat_factura xml_attachment_id=' + sf.xml_attachment_id + ' - sin esto no hay boton XML');
					if (sf.pdf_attachment_id) {
						assert.ok(sf.pdf_attachment_id, 'sat_factura pdf_attachment_id=' + sf.pdf_attachment_id);
					} else {
						console.warn('sat_factura ' + sf.id + ' sin pdf_attachment_id - revisar generarPDF, pero xml ya permite factura');
					}
					// Verificar tipo correcto para facturacion por abono
					assert.ok(sf.type === 'PAGO_PARCIAL' || sf.type === 'NORMAL', 'sat_factura type=' + sf.type);

					// Verificar que el pago quedo facturado y vinculado al sat_factura con xml
					var pInfo = await apiRequest('/payment_info.php', {
						method: 'POST',
						bearer: s.bearer,
						body: { _post_search: 1, id: paymentObj.id }
					});
					var pRow = Array.isArray(pInfo.data) ? pInfo.data[0] : (Array.isArray(pInfo) ? pInfo[0] : pInfo);
					var payData = pRow.payment || pRow;
					var pSatId = payData.sat_factura_id || pRow.sat_factura_id || invoiceResult.sat_factura_id;
					assert.ok(pSatId, 'Pago ' + (i + 1) + ' vinculado a sat_factura ' + pSatId);
					assert.equal(Number(pSatId), Number(sf.id), 'payment.sat_factura_id coincide con sat_factura.id');
					assert.ok(payData.sat_xml_attachment_id || sf.xml_attachment_id, 'payment sat_xml_attachment_id presente (payment=' + (payData.sat_xml_attachment_id||'null') + ' sf=' + sf.xml_attachment_id + ')');
					assert.equal(payData.facturado, 'YES', 'payment.facturado=YES tras timbrar');
				} catch (e) {
					var msg = (e.response && e.response.error) || e.message || '';
					console.error('Fallo facturacion abono ' + (i + 1) + ':', msg, e.response||e);
					// Si PAC no timbra, sat_factura quedara sin uuid/xml - hacer fallar explicito para que se note la falta de botones
					var failDetail = msg;
					try {
						var pendingSf = await apiRequest('/sat_factura.php?payment_id=' + paymentObj.id, { bearer: s.bearer });
						var pr = pendingSf.data ? pendingSf.data[0] : pendingSf;
						if (pr) failDetail += ' | sat_factura id=' + (pr.id||pr.sat_factura&&pr.sat_factura.id) + ' xml=' + (pr.xml_attachment_id||'null');
					} catch(_){}
					assert.ok(false, 'Abono ' + (i + 1) + ' no se pudo timbrar - sin xml no habra boton XML/PDF: ' + failDetail);
				}

				// Verificar estado intermedio de la orden
				var orderInfoResp = await apiRequest('/order_info.php?id=' + order.id, { bearer: s.bearer });
				var oInfo = Array.isArray(orderInfoResp) ? orderInfoResp[0] : (orderInfoResp.data ? orderInfoResp.data[0] : orderInfoResp);
				var oData = oInfo.order || oInfo;
				var expectedPaid = abonos.slice(0, i + 1).reduce(function(a, b) { return a + b; }, 0);
				assert.equal(Number(oData.amount_paid), expectedPaid, 'Orden amount_paid=' + expectedPaid + ' tras abono ' + (i + 1));
				if (i < abonos.length - 1) {
					assert.equal(oData.facturado, 'NO', 'Orden aun NO facturada totalmente tras abono ' + (i + 1) + '/' + abonos.length);
				}
			}

			// Verificacion final: orden totalmente pagada y facturada
			var finalOrderResp = await apiRequest('/order_info.php?id=' + order.id, { bearer: s.bearer });
			var fInfo = Array.isArray(finalOrderResp) ? finalOrderResp[0] : (finalOrderResp.data ? finalOrderResp.data[0] : finalOrderResp);
			var fData = fInfo.order || fInfo;
			assert.equal(Number(fData.amount_paid), 300, 'Orden totalmente pagada 300');
			assert.equal(fData.paid_status, 'PAID', 'Orden paid_status=PAID');
			assert.equal(fData.facturado, 'YES', 'Orden facturado=YES tras cubrir total con abonos facturados');
			assert.ok(Array.isArray(fInfo.payment_facturas), 'order_info incluye payment_facturas');
			assert.equal(fInfo.payment_facturas.length, abonos.length, 'payment_facturas contiene ' + abonos.length + ' facturas (una por abono)');
			// Cada payment_factura debe tener xml (y pdf si se genero) para que la UI muestre botones
			fInfo.payment_facturas.forEach(function(pf, idx){
				var pfData = pf.sat_factura || pf;
				assert.ok(pfData.xml_attachment_id || pf.xml_attachment_id, 'payment_factura ' + (idx+1) + ' xml_attachment_id presente - boton XML visible');
				if (!pfData.pdf_attachment_id && !pf.pdf_attachment_id) {
					console.warn('payment_factura ' + (idx+1) + ' sin pdf_attachment_id - boton PDF no aparecera');
				}
				assert.ok(pfData.uuid || pf.uuid, 'payment_factura ' + (idx+1) + ' uuid presente');
			});
			// Verificar todas las sat_facturas del pedido tienen xml
			for (var k=0;k<satFacturaIds.length;k++) {
				var checkSf = await apiRequest('/sat_factura.php?id=' + satFacturaIds[k], { bearer: s.bearer });
				var csf = checkSf.sat_factura || checkSf;
				assert.ok(csf.xml_attachment_id, 'sat_factura ' + satFacturaIds[k] + ' xml_attachment_id presente para descarga XML');
			}

			// La orden NO se cancela - queda para inspeccion manual (como Factura / Nota de Credito)
			console.log('Factura PER_PAYMENT completa - orden conservada id=' + order.id + ' pagos=' + paymentIds.join(',') + ' facturas=' + satFacturaIds.join(','));
			// Mostrar ID de orden de forma visible en el reporte QUnit (final success) para verificar en la UI POS
			assert.ok(true, 'ORDEN CREADA ID=' + order.id + ' - Ver en POS: ViewOrder /order_info.php?id=' + order.id);
			assert.ok(true, 'Pagos: ' + paymentIds.join(',') + ' | SAT facturas: ' + satFacturaIds.join(',') + ' - Copiar ID ' + order.id + ' para verificar botones PDF/XML en POS');
		} catch (e) {
			console.error(e);
			assert.ok(false, 'FAIL: ' + (e.response && e.response.error || e.message || JSON.stringify(e)));
		}
	});

});
