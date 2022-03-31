let end_point = 'http://127.0.0.1/PointOfSale';


let timestamp_regex = /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/;

QUnit.module('Stores', function()
{
	QUnit.test('Public Stores', (assert) =>
	{
		assert.expect(7);
		const done = assert.async();

		doGet(end_point+'/store.php')
		.then((data)=>
		{
			assert.ok(true, 'Request was successful');
			assert.ok(typeof data.total == "number", 'Total encontrado');
			assert.ok(Array.isArray(data.data), 'Data es Array');
			return doGet(end_point+'/store.php?id='+data.data[0].id);
		})
		.then((store)=>
		{
			console.log( store );
			//assert.stricEqual(typeof store.id,"number",'Contiene un id');
			assert.equal(typeof store.id,"number",'Contiene un id');
			assert.equal(typeof store.name,"string",'Tiene un nombre');
			assert.ok(timestamp_regex.test( store.created ),'Has creation date');
			assert.ok(timestamp_regex.test( store.updated ),'Has updated date');
			done();
		},(error)=>{
			console.error(error);
			assert.ok(false, 'Request failed');
			done();
		})
	});

	QUnit.test('User ME', (assert) =>
	{
		assert.expect(1);
		const done = assert.async();

		doGet(end_point+'/user.php?me=1',undefined)
		.then
		(
			(data)=>
			{
				assert.ok(false, 'Request was successful without credentials');
			}
		).catch(()=>{
			console.log('Fallo');
			assert.ok(true,'Fallo user me');
			done();
		});
	})

	QUnit.test('User ME', (assert) =>
	{
		assert.expect(1);
		const done = assert.async();
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
		assert.ok(true, 'Sell Simple');
	});

	QUnit.test('Sell With Options', (assert) =>
	{
		assert.ok(true, 'passed');
	});

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



