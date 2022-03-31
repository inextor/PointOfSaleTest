let end_point = 'http://127.0.0.1/PointOfSale';


QUnit.module('Stores', function()
{
	QUnit.test('Login', (assert)=>
	{
		assert.expect(4);
		const done = assert.async();

		doPost(end_point+'/login.php', {
			"username": "admin",
			"password": "asdf"
		}).then((data)=>
		{
			console.log('data',data);
			assert.ok(true, 'Login Success');
			assert.ok(typeof data.session === "object" , 'Tiene Session');
			assert.ok(typeof data.user === "object" , 'Tiene Usuario');
			assert.ok(typeof data.user_permission === "object" , 'Cuenta Con permisos');
			done();
		})
		.catch(()=>{

			assert.ok(false, 'Login Success');
			done();
		});
	});

	QUnit.test('two numbers', (assert) =>
	{
		assert.expect(3);
		const done = assert.async();

		doGet(end_point+'/store.php')
		.then((data)=>
		{
			assert.ok(true, 'Request was successful');
			assert.ok(typeof data.total == "number", 'Total encontrado');
			assert.ok(Array.isArray(data.data), 'Data es Array');
			done();
		},()=>{
			assert.ok(false, 'Request failed');
			done();
		})
	});

	QUnit.test('User ME', (assert) =>
	{
		assert.expect(1);
		const done = assert.async();

		doGet(end_point+'/user.php?me=1',undefined)
		.then(
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


QUnit.module('Sell',()=>{

});
