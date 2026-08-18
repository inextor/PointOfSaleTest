QUnit.module('Oferta por Lote / Caducidad', function()
{
	async function createBatchItem(bearer, name)
	{
		return getOrCreateItem(bearer, {
			applicable_tax: 'DEFAULT',
			availability_type: 'ON_STOCK',
			batch_option: 'BATCH_AND_EXPIRATION',
			clave_sat: '53111603',
			currency_id: 'MXN',
			name: name,
			note_required: 'NO',
			on_sale: 'YES',
			reference_price: 0,
			status: 'ACTIVE',
			tax_percent: 0,
			unidad_medida_sat_id: 'H87'
		});
	}

	async function addBatchStock(bearer, itemId, storeId, batch, expirationDate, qty)
	{
		return apiRequest('/updates/stock_add.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				item_id: itemId,
				store_id: storeId,
				qty: qty,
				comment: 'POSTest batch stock',
				batch: batch,
				expiration_date: expirationDate
			}
		});
	}

	function randomBatch(prefix)
	{
		return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
	}

	function shortCouponCode(prefix)
	{
		return (prefix + Math.floor(Math.random() * 100000000)).slice(0, 10);
	}

	async function createPercentOfferByBatch(bearer, itemId, batch, percent)
	{
		return apiRequest('/offer.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				name: 'Oferta por lote test',
				coupon_code: shortCouponCode('LOT'),
				type: 'PERCENT_DISCOUNT',
				item_id: itemId,
				batch: batch,
				qty: percent,
				store_id: null,
				price_type_id: null,
				hour_start: '00:00',
				hour_end: '23:59',
				is_valid_monday: 1,
				is_valid_tuesday: 1,
				is_valid_wednesday: 1,
				is_valid_thursday: 1,
				is_valid_friday: 1,
				is_valid_saturday: 1,
				is_valid_sunday: 1,
				valid_from: '2020-01-01 00:00:00',
				valid_thru: '2100-01-01 00:00:00',
				n: 1,
				m: 1,
				price: 0,
				discount: 0
			}
		});
	}

	async function createPercentOfferByExpirationDays(bearer, itemId, days)
	{
		return apiRequest('/offer.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				name: 'Oferta por caducidad test',
				coupon_code: shortCouponCode('EXP'),
				type: 'PERCENT_DISCOUNT',
				item_id: itemId,
				expiration_days: days,
				qty: 50,
				store_id: null,
				price_type_id: null,
				hour_start: '00:00',
				hour_end: '23:59',
				is_valid_monday: 1,
				is_valid_tuesday: 1,
				is_valid_wednesday: 1,
				is_valid_thursday: 1,
				is_valid_friday: 1,
				is_valid_saturday: 1,
				is_valid_sunday: 1,
				valid_from: '2020-01-01 00:00:00',
				valid_thru: '2100-01-01 00:00:00',
				n: 1,
				m: 1,
				price: 0,
				discount: 0
			}
		});
	}

	async function createAmountOfferByBatch(bearer, itemId, batch, amount)
	{
		return apiRequest('/offer.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				name: 'Oferta cantidad por lote test',
				coupon_code: shortCouponCode('AMT'),
				type: 'AMOUNT_DISCOUNT',
				item_id: itemId,
				batch: batch,
				qty: amount,
				store_id: null,
				price_type_id: null,
				hour_start: '00:00',
				hour_end: '23:59',
				is_valid_monday: 1,
				is_valid_tuesday: 1,
				is_valid_wednesday: 1,
				is_valid_thursday: 1,
				is_valid_friday: 1,
				is_valid_saturday: 1,
				is_valid_sunday: 1,
				valid_from: '2020-01-01 00:00:00',
				valid_thru: '2100-01-01 00:00:00',
				n: 1,
				m: 1,
				price: 0,
				discount: 0
			}
		});
	}

	async function createNxmOfferByBatch(bearer, itemId, batch, n, m)
	{
		return apiRequest('/offer.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				name: 'Oferta MXN por lote test',
				coupon_code: shortCouponCode('MXN'),
				type: 'N_X_M',
				item_id: itemId,
				batch: batch,
				qty: 0,
				n: n,
				m: m,
				store_id: null,
				price_type_id: null,
				hour_start: '00:00',
				hour_end: '23:59',
				is_valid_monday: 1,
				is_valid_tuesday: 1,
				is_valid_wednesday: 1,
				is_valid_thursday: 1,
				is_valid_friday: 1,
				is_valid_saturday: 1,
				is_valid_sunday: 1,
				valid_from: '2020-01-01 00:00:00',
				valid_thru: '2100-01-01 00:00:00',
				price: 0,
				discount: 0
			}
		});
	}

	function buildOrderPayload(itemId, storeId, qty, unitaryPrice, batch, expirationDate)
	{
		var subtotal = Number((qty * unitaryPrice).toFixed(2));

		return {
			order: {
				billing_data_id: 1,
				cashier_user_id: 1,
				client_name: 'PUBLICO GRAL',
				currency_id: 'MXN',
				marked_for_billing: null,
				note: null,
				paid_status: null,
				price_type_id: 1,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				store_id: storeId,
				sync_id: storeId + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
				subtotal: 0,
				tax: 0,
				tax_percent: 0,
				total: 0,
				discount: 0
			},
			items: [
				{
					order_item: {
						item_id: itemId,
						delivery_status: 'PENDING',
						stock_status: 'IN_STOCK',
						tax_included: 'NO',
						delivered_qty: 0,
						status: 'ACTIVE',
						commanda_status: 'NOT_DISPLAYED',
						item_group: Date.now(),
						return_required: 'NO',
						is_item_extra: 'NO',
						is_free_of_charge: 'NO',
						note: '',
						qty: qty,
						item_option_qty: 1,
						paid_qty: 0,
						original_unitary_price: unitaryPrice,
						unitary_price: unitaryPrice,
						subtotal: subtotal,
						discount: 0,
						discount_percent: 0,
						tax: 0,
						total: subtotal,
						preparation_status: 'PENDING'
					},
					batches: [
						{ batch: batch, expiration_date: expirationDate, qty: qty }
					]
				}
			]
		};
	}

	async function createOrder(bearer, payload)
	{
		var response = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: bearer,
			body: payload
		});

		if (!response.order || !response.order.id)
			throw new Error('Order creation did not return order.id: ' + JSON.stringify(response));

		return response;
	}

	async function applyOffers(bearer, orderId, offerIds)
	{
		var minutesOffset = new Date().getTimezoneOffset();

		return apiRequest('/updates.php', {
			method: 'POST',
			bearer: bearer,
			body: {
				method: 'applyOffers',
				order_id: orderId,
				offer_ids: offerIds.join(','),
				minutes_offset: minutesOffset
			}
		});
	}

	async function fetchOrder(bearer, orderId)
	{
		return apiRequest('/order_info.php?id=' + orderId, { bearer: bearer });
	}

	function firstItem(orderInfo)
	{
		return orderInfo.items[0].order_item;
	}

	QUnit.test('PERCENT_DISCOUNT por lote: aplica solo al lote correcto', async (assert) =>
	{
		assert.expect(9);

		try
		{
			const { bearer, user } = await login();
			const storeId = Number(user.store_id || 1);
			assert.ok(true, 'Login ok');

			const item = await createBatchItem(bearer, 'Test Offer Item 1');
			const batchA = randomBatch('A');
			const batchB = randomBatch('B');
			const expA = '2099-01-01';
			const expB = '2099-01-01';

			await addBatchStock(bearer, item.id, storeId, batchA, expA, 20);
			await addBatchStock(bearer, item.id, storeId, batchB, expB, 20);

			const offer = await createPercentOfferByBatch(bearer, item.id, batchB, 50);
			assert.ok(offer.id, 'Oferta por lote creada id=' + offer.id);
			assert.equal(offer.batch, batchB, 'Oferta guarda el lote');

			const orderA = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchA, expA));
			const appliedA = await applyOffers(bearer, orderA.order.id, [offer.id]);
			const reloadedA = await fetchOrder(bearer, orderA.order.id);
			const itemA = firstItem(reloadedA);
			assert.ok(!appliedA, 'No se aplico la oferta al lote distinto');
			assert.equal(itemA.offer_id, null, 'Item del lote A no tiene oferta');
			assert.equal(Number(itemA.unitary_price), 100, 'Precio del lote A sin descuento');

			const orderB = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchB, expB));
			const appliedB = await applyOffers(bearer, orderB.order.id, [offer.id]);
			const reloadedB = await fetchOrder(bearer, orderB.order.id);
			const itemB = firstItem(reloadedB);
			assert.ok(appliedB, 'Se aplico la oferta al lote correcto');
			assert.equal(itemB.offer_id, offer.id, 'Item del lote B tiene la oferta');
			assert.equal(Number(itemB.unitary_price), 50, 'Precio del lote B con 50% de descuento');

			await cancelTestOrder(bearer, orderA.order.id, 'POSTest offer percent batch');
			await cancelTestOrder(bearer, orderB.order.id, 'POSTest offer percent batch');
		}
		catch(error)
		{
			console.log('Error completo:', JSON.stringify(error));
			assert.ok(false, 'Fallo test PERCENT por lote: ' + (error.error || error.message || JSON.stringify(error)));
		}
	});

	QUnit.test('AMOUNT_DISCOUNT por lote: descuenta cantidad solo al lote correcto', async (assert) =>
	{
		assert.expect(9);

		try
		{
			const { bearer, user } = await login();
			const storeId = Number(user.store_id || 1);
			assert.ok(true, 'Login ok');

			const item = await createBatchItem(bearer, 'Test Offer Item 2');
			const batchA = randomBatch('A');
			const batchB = randomBatch('B');
			const exp = '2099-01-01';

			await addBatchStock(bearer, item.id, storeId, batchA, exp, 20);
			await addBatchStock(bearer, item.id, storeId, batchB, exp, 20);

			const offer = await createAmountOfferByBatch(bearer, item.id, batchB, 20);
			assert.ok(offer.id, 'Oferta por cantidad creada id=' + offer.id);
			assert.equal(offer.batch, batchB, 'Oferta guarda el lote');

			const orderA = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchA, exp));
			const appliedA = await applyOffers(bearer, orderA.order.id, [offer.id]);
			const reloadedA = await fetchOrder(bearer, orderA.order.id);
			const itemA = firstItem(reloadedA);
			assert.ok(!appliedA, 'No se aplico la oferta al lote distinto');
			assert.equal(itemA.offer_id, null, 'Item del lote A no tiene oferta');
			assert.equal(Number(itemA.unitary_price), 100, 'Precio del lote A sin descuento');

			const orderB = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchB, exp));
			const appliedB = await applyOffers(bearer, orderB.order.id, [offer.id]);
			const reloadedB = await fetchOrder(bearer, orderB.order.id);
			const itemB = firstItem(reloadedB);
			assert.ok(appliedB, 'Se aplico la oferta al lote correcto');
			assert.equal(itemB.offer_id, offer.id, 'Item del lote B tiene la oferta');
			assert.equal(Number(itemB.unitary_price), 80, 'Precio del lote B con 20 de descuento');

			await cancelTestOrder(bearer, orderA.order.id, 'POSTest offer amount batch');
			await cancelTestOrder(bearer, orderB.order.id, 'POSTest offer amount batch');
		}
		catch(error)
		{
			console.log('Error completo:', JSON.stringify(error));
			assert.ok(false, 'Fallo test AMOUNT por lote: ' + (error.error || error.message || JSON.stringify(error)));
		}
	});

	QUnit.test('PERCENT_DISCOUNT por caducidad (dias): aplica solo a caducidad proxima', async (assert) =>
	{
		assert.expect(8);

		try
		{
			const { bearer, user } = await login();
			const storeId = Number(user.store_id || 1);
			assert.ok(true, 'Login ok');

			const item = await createBatchItem(bearer, 'Test Offer Item 3');
			const batchFar = randomBatch('FAR');
			const batchNear = randomBatch('NEAR');
			const today = new Date();
			const daysFromNow = function(n)
			{
				var d = new Date(today);
				d.setDate(d.getDate() + n);
				return d.toISOString().slice(0, 10);
			};

			await addBatchStock(bearer, item.id, storeId, batchFar, daysFromNow(400), 20);
			await addBatchStock(bearer, item.id, storeId, batchNear, daysFromNow(10), 20);

			const offer = await createPercentOfferByExpirationDays(bearer, item.id, 30);
			assert.ok(offer.id, 'Oferta por caducidad creada id=' + offer.id);
			assert.equal(offer.expiration_days, 30, 'Oferta guarda los dias de caducidad');

			const orderFar = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchFar, daysFromNow(400)));
			const appliedFar = await applyOffers(bearer, orderFar.order.id, [offer.id]);
			const reloadedFar = await fetchOrder(bearer, orderFar.order.id);
			const itemFar = firstItem(reloadedFar);
			assert.ok(!appliedFar, 'No se aplico la oferta a caducidad lejana');
			assert.equal(itemFar.offer_id, null, 'Item de caducidad lejana sin oferta');

			const orderNear = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchNear, daysFromNow(10)));
			const appliedNear = await applyOffers(bearer, orderNear.order.id, [offer.id]);
			const reloadedNear = await fetchOrder(bearer, orderNear.order.id);
			const itemNear = firstItem(reloadedNear);
			assert.ok(appliedNear, 'Se aplico la oferta a caducidad proxima');
			assert.equal(itemNear.offer_id, offer.id, 'Item de caducidad proxima tiene la oferta');
			assert.equal(Number(itemNear.unitary_price), 50, 'Precio con 50% de descuento');

			await cancelTestOrder(bearer, orderFar.order.id, 'POSTest offer percent expiration');
			await cancelTestOrder(bearer, orderNear.order.id, 'POSTest offer percent expiration');
		}
		catch(error)
		{
			console.log('Error completo:', JSON.stringify(error));
			assert.ok(false, 'Fallo test PERCENT por caducidad: ' + (error.error || error.message || JSON.stringify(error)));
		}
	});

	QUnit.test('N_X_M por lote: regala solo items del lote correcto', async (assert) =>
	{
		assert.expect(10);

		try
		{
			const { bearer, user } = await login();
			const storeId = Number(user.store_id || 1);
			assert.ok(true, 'Login ok');

			const item = await createBatchItem(bearer, 'Test Offer Item 4');
			const batchA = randomBatch('A');
			const batchB = randomBatch('B');
			const exp = '2099-01-01';

			await addBatchStock(bearer, item.id, storeId, batchA, exp, 20);
			await addBatchStock(bearer, item.id, storeId, batchB, exp, 20);

			const offer = await createNxmOfferByBatch(bearer, item.id, batchB, 2, 1);
			assert.ok(offer.id, 'Oferta MXN creada id=' + offer.id);
			assert.equal(offer.type, 'N_X_M', 'Oferta es MXN');

			const orderA = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchA, exp));
			const appliedA = await applyOffers(bearer, orderA.order.id, [offer.id]);
			const reloadedA = await fetchOrder(bearer, orderA.order.id);
			const itemA = firstItem(reloadedA);
			assert.ok(!appliedA, 'No se aplico MXN al lote distinto');
			assert.equal(itemA.is_free_of_charge, 'NO', 'Item del lote A no es gratis');

			const orderB = await createOrder(bearer, buildOrderPayload(item.id, storeId, 2, 100, batchB, exp));
			const appliedB = await applyOffers(bearer, orderB.order.id, [offer.id]);
			const reloadedB = await fetchOrder(bearer, orderB.order.id);
			assert.ok(appliedB, 'Se aplico MXN al lote correcto');

			const freeItem = reloadedB.items.find(i => i.order_item.offer_id == offer.id);
			const paidItem = reloadedB.items.find(i => i.order_item.offer_id != offer.id);
			assert.ok(freeItem, 'Existe un item gratis con la oferta MXN');
			assert.equal(freeItem.order_item.is_free_of_charge, 'YES', 'El item gratis esta marcado como de cortesia');
			assert.equal(paidItem.order_item.is_free_of_charge, 'NO', 'El item pagado no es gratis');
			assert.equal(Number(freeItem.order_item.qty) + Number(paidItem.order_item.qty), 2, 'La suma de cantidades se conserva (2x1)');

			await cancelTestOrder(bearer, orderA.order.id, 'POSTest offer nxm batch');
			await cancelTestOrder(bearer, orderB.order.id, 'POSTest offer nxm batch');
		}
		catch(error)
		{
			console.log('Error completo:', JSON.stringify(error));
			assert.ok(false, 'Fallo test MXN por lote: ' + (error.error || error.message || JSON.stringify(error)));
		}
	});
});