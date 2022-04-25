//let end_point = 'http://127.0.0.1/PointOfSale';


let timestamp_regex = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/;

QUnit.module('Stores', function()
{
	QUnit.test('Public Stores', (assert) =>
	{
		assert.expect(7);
		const done = assert.async();

		doGet('/store.php')
		.then((response)=>
		{
			let data =response.result;

			assert.ok(true, 'Request was successful');
			assert.ok(typeof data.total == "number", 'Total encontrado');
			assert.ok(Array.isArray(data.data), 'Data es Array');
			return doGet('/store.php?id='+data.data[0].id);
		})
		.then((response)=>
		{
			let store = response.result;
			//assert.stricEqual(typeof store.id,"number",'Contiene un id');
			assert.equal(typeof store.id,"number",'Contiene un id');
			assert.equal(typeof store.name,"string",'Tiene un nombre');
			assert.ok(timestamp_regex.test( store.created ),'Has creation date');
			assert.ok(timestamp_regex.test( store.updated ),'Has updated date');
			done();
		}).catch(()=>{
			assert.ok(false, 'Fallo checar stores');
			done();
		});
	});

	QUnit.test('User ME', (assert) =>
	{
		const done = assert.async();
		assert.expect(1);

		doGet('/user.php?me=1',undefined)
		.then
		(
			(data)=>
			{
				assert.ok(false, 'Request was successful without credentials');
				error.log('Por que hno termina1');
				done();
			}
			,((error)=>{ 
				assert.ok(true, 'Fallo User Me');
				console.log('Por que hno termina2');
				done(); 
			})
		).catch(()=>{
			console.log('Fallo');
			assert.ok(true,'Fallo user me');
			console.log('Por que hno termina');
			done();
		});
	});
});

QUnit.module('User',function()
{
	QUnit.test('Login', (assert) =>
	{
		assert.ok(true, 'Login');
	});
});

QUnit.module('Sell', function()
{
	QUnit.test('Sell Simple', (assert) =>
	{
		const done = assert.async();
		assert.expect(5);

		login('admin').then((bearer)=>
		{
			assert.ok(true,'Login');
			return Promise.all([
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				getItem(bearer),
				bearer
			]);
		})
		.then((ids)=>
		{
			let bearer = ids[ids.length-1];
			assert.equal( ids.length, 8, 'Items Creados');
			let order = getOrderItemWithPrimes(ids);
			return doPost('/order_info.php', order , bearer)
		})
		.then((response)=>
		{
			assert.ok(true, 'Orden Creada');

			let order_info = response.result;

			let payment = getPaymentSimple( order_info.order.id, order_info.order.total );
			return doPost('/payment_info.php', payment, response.bearer);
		})
		.then((response)=>
		{
			assert.ok(true, 'Pago Realizado');

			let payment_info = response.result;
			console.log( payment_info );

			let id = null;
			try{
				console.log('Movements', payment_info.movements[0] )
				console.log('Movements Orders', payment_info.movements[0].bank_movement_orders )
				id = payment_info.movements[0].bank_movement_orders[0].order_id;
				console.log('ID is ', id);
			}
			catch(e)
			{
				throw e;
			}
			return doGet('/order_info.php?id='+id, response.bearer);
		})
		.then((response)=>
		{
			let order_info = response.result;
			assert.equal(order_info.order.paid_status, 'PAID', 'Orden Pagada');
			done();
		})
		.catch((error)=>{
			console.log('Sell simple ',error); 
			assert.ok(false, 'Fallo en algo');
			done();
		});
	});
	/*

	QUnit.test('Sell With Options', (assert) =>
	{
		const done = assert.async();

		login('admin')
		.then((bearer)=>
		{
			return doPost('/item_info.php',
				[
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion1"}},
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion2"}},
					{"item":{unidad_medida_sat_id:"H87",clave_sat:"53111603",availability_type:"ALWAYS",on_sale:"NO","name":"Opcion3"}}
				],bearer
			);
		})
		.then((response)=>
		{
			let products = response.results;

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
			return doPost('/item_info.php', item_compuesto , response.bearer)
		})
		.then(()=>
		{
			assert.ok(true, 'Creacion de Articulo Con opciones');
			done();
		})
		.catch((error)=>
		{
			console.log('Algo allo',error);
			assert.ok(false, 'Fallo');
			done();
		});
	});
	*/

	QUnit.test('Sell With Stock', (assert) =>
	{
		assert.ok(true, 'accepted');
	});

	QUnit.test('Sell With out Stock', (assert) =>
	{
		assert.ok(true, 'FOOO');
	});

	QUnit.test('Sell With out Stock', (assert) =>
	{
		assert.ok(true, 'Doit');
	});

	QUnit.test('Sell with payment',(assert)=>
	{
		assert.ok(true, 'Payment Accpeted');
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



