QUnit.module('Stores', function()
{
	QUnit.test('Public Stores', async (assert) =>
	{
		assert.expect(7);

		try
		{
			let response = await doGet('/store.php');
			let data = response.result;

			assert.ok(true, 'Request was successful');
			assert.ok(typeof data.total == "number", 'Total encontrado');
			assert.ok(Array.isArray(data.data), 'Data es Array');

			response = await doGet('/store.php?id=' + data.data[0].id);
			let store = response.result;

			assert.equal(typeof store.id, "number", 'Contiene un id');
			assert.equal(typeof store.name, "string", 'Tiene un nombre');
			assert.ok(timestamp_regex.test(store.created), 'Has creation date');
			assert.ok(timestamp_regex.test(store.updated), 'Has updated date');
		}
		catch(e)
		{
			console.log(e);
			assert.ok(false, 'Fallo checar stores');
		}
	});

	QUnit.test('User ME', async (assert) =>
	{
		assert.expect(1);

		try
		{
			await doGet('/user.php?me=1', undefined);
			assert.ok(false, 'Request was successful without credentials');
		}
		catch(error)
		{
			assert.ok(true, 'Fallo User Me');
		}
	});
});

QUnit.module('Sell', function()
{
	QUnit.test('Sell duplicate', async (assert) =>
	{
		assert.expect(4);

		try
		{
			let d = new Date();
			console.log(d.getFullYear());
			console.log(d);
			let random = '' + (d.getFullYear()) + '-' + d.getMonth() + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
			console.log('Random is', random);

			const { bearer } = await login();
			console.log('Running 1');
			assert.ok(true, 'Login');

			let ids = await Promise.all([
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer, 'ON_STOCK', 200, 1)
			]);

			assert.equal(ids.length, 7, 'Items Creados');

			let order = getOrderItemWithPrimes(ids);
			order.order.sync_id = random;

			await Promise.all([
				doPost('/order_info.php', order, bearer),
				doPost('/order_info.php', order, bearer)
			]);

			assert.ok(true, 'ordenes creadas');

			let response = await doGet('/order_info.php?sync_id,=' + random, bearer);

			console.log(response);
			assert.ok(response.result.data.length == 1, 'Orden creada sin duplicados');
		}
		catch(error)
		{
			console.log(error);
			assert.ok(false, 'Fallo al verificar orden sin duplicados: ' + (error.message || error));
		}
	});

	QUnit.test('Sell Simple', async (assert) =>
	{
		assert.expect(5);

		try
		{
			const { bearer } = await login();
			console.log('Running 1');
			assert.ok(true, 'Login');

			let ids = await Promise.all([
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer, 'ON_STOCK', 200, 1)
			]);

			assert.equal(ids.length, 7, 'Items Creados');

			let order = getOrderItemWithPrimes(ids);
			let response = await doPost('/order_info.php', order, bearer);

			assert.ok(true, 'Orden Creada');

			console.log('Orden', response.result);
			let order_info = response.result;

			let payment = getPaymentSimple(order_info.order.id, order_info.order.total);
			response = await doPost('/payment_info.php', payment, response.bearer);

			assert.ok(true, 'Pago Realizado');

			let payment_info = response.result;
			console.log(payment_info);

			let id = null;
			try
			{
				console.log('Movements', payment_info.movements[0]);
				console.log('Movements Orders', payment_info.movements[0].bank_movement_orders);
				id = payment_info.movements[0].bank_movement_orders[0].order_id;
				console.log('Obteniendo order_id', id);
			}
			catch(e)
			{
				console.log("Que fallo????", e);
				throw e;
			}

			response = await doGet('/order_info.php?id=' + id, response.bearer);

			let reloaded_order_info = response.result;
			console.log('Order Info', reloaded_order_info);
			assert.equal(reloaded_order_info.order.paid_status, 'PAID', 'Orden Pagada');
		}
		catch(error)
		{
			console.log('Sell simple ', error);
			assert.ok(false, 'Fallo en Sell Simple: ' + (error.message || error));
		}
	});

	QUnit.test('Sell With Options', async (assert) =>
	{
		try
		{
			const { bearer } = await login();

			let response = await doPost('/item_info.php',
				[
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion1"}},
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion2"}},
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion3"}}
				], bearer
			);

			let products = response.result;

			assert.ok(true, 'Creacion Articulos de opciones');

			let item_compuesto = {"item":{
				note_required:"NO",availability_type:"ALWAYS",on_sale:"YES",status:"ACTIVE",name:"compuesto"},options:[
					{
						values:
						[
							{ item_option_value:{item_id: products[0].item.id ,max_extra_qty:1,extra_price:0,price:0} },
							{ item_option_value:{item_id: products[1].item.id ,max_extra_qty:1,extra_price:0,price:0} },
							{ item_option_value:{item_id: products[2].item.id ,max_extra_qty:1,extra_price:0,price:0} }
						],
						item_option:{"name":"Opcion",included_options:1,included_extra_qty:1,max_extra_qty:1,max_options:1}
					}
				]
			};

			await doPost('/item_info.php', item_compuesto, response.bearer);
			assert.ok(true, 'Creacion de Articulo Con opciones');
		}
		catch(error)
		{
			console.log('Algo allo', error);
			assert.ok(false, 'Fallo');
		}
	});
});

QUnit.module('Purchase Orders', function()
{
	QUnit.test('Adding to Stock', (assert) =>
	{
		assert.ok(true, 'Created');
	});

	QUnit.test('With Shipping to Store', (assert) =>
	{
		assert.ok(true, 'Sell Simple');
	});
});

QUnit.module('Payment Pharos', function()
{
	QUnit.test('Payment Pharos', async (assert) =>
	{
		try
		{
			const { bearer } = await login();
			console.log('Running 1');
			assert.ok(true, 'Login Payment Pharos');

			let response = await promiseObject({
				"item_1": getItem(bearer),
				"item_2": getItemWithCommanda(bearer, 1),
				"client": getNewClientP(bearer),
				"bearer": bearer
			});

			let client = response.client.result;
			assert.ok(true, 'Usuario creado');

			response = await promiseObject({
				"item_1": response.item_1,
				"item_2": response.item_2,
				"client": client,
				"bearer": response.bearer,
				"address": getNewAdressP(client.id, response.bearer)
			});

			assert.ok(true, 'Direccion creada');

			let order = getOrderItemWithPrimes([response.item_1, response.item_2]);
			order.order.sync_id = getRandom();
			order.order.client_user_id = response.client.id;
			order.order.shipping_address_id = response.address.result.id;
			order.order.address = response.address.result.address;
			order.order.service_type = 'TOGO';

			let result = await doPost('/order_info.php', order, response.bearer);

			let order_info = result.result;
			let obj = {
				action: 'PAY',
				order_id: order_info.order.id,
				card_number: '1234567890123456',
				exp_month: '02',
				exp_year: '23',
				sec_code: '0004',
				last_four: '3456',
				cardholder_name: 'Juan Perez',
			};

			assert.ok(true, 'ordenes creadas');
			await doPost('/pharos_order.php', obj, result.bearer);
			assert.ok(true, 'Pago completado');
		}
		catch(error)
		{
			console.log('ERROR', error);
			assert.ok(false, 'Fallo todo el proceso de compra');
		}
	});
});


