
function doGet(path,bearer)
{
	let headers =  {
	    "accept": "application/json, text/plain, */*",
	    "content-type": "application/json",
	  }

	if( bearer )
	{
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(path, {
		"headers": {
			"accept": "application/json, text/plain, */*",
			"content-type": "application/json",
		},
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"method": "GET",
		"mode": "cors",
		"credentials": "omit"
	}).then(r=>r.json());
}



function doPost(path, body, bearer)
{
	let headers =  {
	    "accept": "application/json, text/plain, */*",
	    "content-type": "application/json",
	  }

	if( bearer )
	{
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(path, {
		"headers": {
			"accept": "application/json, text/plain, */*",
			"content-type": "application/json",
		},
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": JSON.stringify(body),
		"method": "POST",
		"mode": "cors",
		"credentials": "omit"
	}).then(r=>r.json());
}

function login(user_type)
{
	let user = 'admin';

	if( user_type == 'admin' )
	{
		user = 'admin';
	}
	else if( user_type == 'cashier' )
	{
		user = 'admin';
	}
	else if( user_type == 'cashier' )
	{
		user = 'admin';
	}

	return doPost(end_point+'/login.php',
	{
			"username": "admin",
			"password": "asdf"
	}).then((data)=>
	{
		return data.session.id;
	});
}


function hasPassword(obj)
{
	return false;
}
