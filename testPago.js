
window.addEventListener('load',(evt)=>
{
	let button_start  = document.getElementById('button_start');
	button_start.addEventListener('click',(evt)=>
	{
		testAgain();
	});
});

function testAgain()
{
	let headers = {
	    "accept": "application/json, text/plain, */*",
	    "accept-language": "en-US,en;q=0.9",
	    "authorization": "Bearer QGJVlIazhEbIGEsz",
	    "content-type": "application/json",
	    "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
	    "sec-ch-ua-mobile": "?0",
	    "sec-ch-ua-platform": "\"Linux\"",
	    "sec-fetch-dest": "empty",
	    "sec-fetch-mode": "cors",
	    "sec-fetch-site": "same-site"
	};
	
	let sync_id =  '8-' + Date.now();
	let pay_sync_id = '8-'+Date.now()+3;
	
	//Crea la orden
	fetch("http://127.0.0.1/PointOfSale/order_info.php", {
	  headers,
	  "referrer": "http://127.0.0.1:4000/",
	  "referrerPolicy": "strict-origin-when-cross-origin",
	  "body": '{"items":[{"order_item":{"discount_percent":0,"exceptions":"","item_id":31,"has_separator":"NO","qty":1,"offer_id":null,"tax":8.275839999999999,"item_group":1689780143610,"tax_included":"YES","unitary_price_meta":60,"original_unitary_price":60,"stock_status":"IN_STOCK","unitary_price":51.724,"status":"ACTIVE","type":"NORMAL","total":59.99983999999999,"is_free_of_charge":"NO","note":"","subtotal":51.724},"exceptions":[],"order_item_exceptions":[],"options":[],"serials":[],"serials_string":"","created":"2023-07-19T15:22:23.610Z","commanda_type_id":2},{"order_item":{"discount_percent":0,"exceptions":"","item_id":31,"has_separator":"NO","qty":1,"offer_id":null,"tax":8.275839999999999,"item_group":1689780144187,"tax_included":"YES","unitary_price_meta":60,"original_unitary_price":60,"stock_status":"IN_STOCK","unitary_price":51.724,"status":"ACTIVE","type":"NORMAL","total":59.99983999999999,"is_free_of_charge":"NO","note":"","subtotal":51.724},"exceptions":[],"order_item_exceptions":[],"options":[],"serials":[],"serials_string":"","created":"2023-07-19T15:22:24.187Z","commanda_type_id":2},{"order_item":{"discount_percent":0,"exceptions":"","item_id":31,"has_separator":"NO","qty":1,"offer_id":null,"tax":8.275839999999999,"item_group":1689780144655,"tax_included":"YES","unitary_price_meta":60,"original_unitary_price":60,"stock_status":"IN_STOCK","unitary_price":51.724,"status":"ACTIVE","type":"NORMAL","total":59.99983999999999,"is_free_of_charge":"NO","note":"","subtotal":51.724},"item":{"id":31,"applicable_tax":"DEFAULT","background":"transparent","commission":0,"commission_type":"NONE","commission_currency_id":"MXN","product_id":null,"commanda_type_id":2,"category_id":10,"currency_id":"MXN","image_id":null,"brand_id":null,"provider_user_id":null,"code":null,"has_serial_number":"NO","name":"Indio","extra_name":null,"note_required":"NO","on_sale":"YES","availability_type":"ALWAYS","status":"ACTIVE","sort_weight":10,"description":null,"reference_price":0,"return_action":"RETURN_TO_STOCK","clave_sat":"01010101","measurement_unit":null,"unidad_medida_sat_id":"H87","created_by_user_id":null,"updated_by_user_id":null,"created":"2022-06-20T21:39:19.000Z","updated":"2023-04-12T17:06:57.000Z","image_style":"COVER","text_color":"#FFFFFF","text_style":"NEVER","shadow_color":"#000000","partial_sale":"NO","qty":0},"category":{"id":10,"name":"Cervezas","code":null,"default_clave_prod_serv":"01010101","type":"PRODUCT","sort_weight":10,"display_status":"NORMAL","image_id":106,"created_by_user_id":1,"updated_by_user_id":1,"created":"2022-06-07T16:28:21.000Z","updated":"2022-06-07T16:28:21.000Z","image_style":"CONTAIN","text_color":"HEADER_COLOR","text_style":"CENTER","shadow_color":"#000000","background":"transparent"},"records":[{"id":2568,"item_id":31,"purchase_detail_id":null,"order_item_id":2790,"store_id":4,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden","is_current":0,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-01-18T23:57:35.000Z","updated":"2023-05-15T19:50:20.000Z"},{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"}],"stock_record":{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"},"price":{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},"prices":[{"id":95,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":96,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":97,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":98,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":99,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":100,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":101,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":102,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":104,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":105,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":106,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"}],"exceptions":[],"order_item_exceptions":[],"options":[],"serials":[],"serials_string":"","created":"2023-07-19T15:22:24.655Z","commanda_type_id":2},{"order_item":{"discount_percent":0,"exceptions":"","item_id":31,"has_separator":"NO","qty":1,"offer_id":null,"tax":8.275839999999999,"item_group":1689780144998,"tax_included":"YES","unitary_price_meta":60,"original_unitary_price":60,"stock_status":"IN_STOCK","unitary_price":51.724,"status":"ACTIVE","type":"NORMAL","total":59.99983999999999,"is_free_of_charge":"NO","note":"","subtotal":51.724},"item":{"id":31,"applicable_tax":"DEFAULT","background":"transparent","commission":0,"commission_type":"NONE","commission_currency_id":"MXN","product_id":null,"commanda_type_id":2,"category_id":10,"currency_id":"MXN","image_id":null,"brand_id":null,"provider_user_id":null,"code":null,"has_serial_number":"NO","name":"Indio","extra_name":null,"note_required":"NO","on_sale":"YES","availability_type":"ALWAYS","status":"ACTIVE","sort_weight":10,"description":null,"reference_price":0,"return_action":"RETURN_TO_STOCK","clave_sat":"01010101","measurement_unit":null,"unidad_medida_sat_id":"H87","created_by_user_id":null,"updated_by_user_id":null,"created":"2022-06-20T21:39:19.000Z","updated":"2023-04-12T17:06:57.000Z","image_style":"COVER","text_color":"#FFFFFF","text_style":"NEVER","shadow_color":"#000000","partial_sale":"NO","qty":0},"category":{"id":10,"name":"Cervezas","code":null,"default_clave_prod_serv":"01010101","type":"PRODUCT","sort_weight":10,"display_status":"NORMAL","image_id":106,"created_by_user_id":1,"updated_by_user_id":1,"created":"2022-06-07T16:28:21.000Z","updated":"2022-06-07T16:28:21.000Z","image_style":"CONTAIN","text_color":"HEADER_COLOR","text_style":"CENTER","shadow_color":"#000000","background":"transparent"},"records":[{"id":2568,"item_id":31,"purchase_detail_id":null,"order_item_id":2790,"store_id":4,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden","is_current":0,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-01-18T23:57:35.000Z","updated":"2023-05-15T19:50:20.000Z"},{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"}],"stock_record":{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"},"price":{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},"prices":[{"id":95,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":96,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":97,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":98,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":99,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":100,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":101,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":102,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":104,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":105,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":106,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"}],"exceptions":[],"order_item_exceptions":[],"options":[],"serials":[],"serials_string":"","created":"2023-07-19T15:22:24.998Z","commanda_type_id":2},{"order_item":{"discount_percent":0,"exceptions":"","item_id":31,"has_separator":"NO","qty":1,"offer_id":null,"tax":8.275839999999999,"item_group":1689780145519,"tax_included":"YES","unitary_price_meta":60,"original_unitary_price":60,"stock_status":"IN_STOCK","unitary_price":51.724,"status":"ACTIVE","type":"NORMAL","total":59.99983999999999,"is_free_of_charge":"NO","note":"","subtotal":51.724},"item":{"id":31,"applicable_tax":"DEFAULT","background":"transparent","commission":0,"commission_type":"NONE","commission_currency_id":"MXN","product_id":null,"commanda_type_id":2,"category_id":10,"currency_id":"MXN","image_id":null,"brand_id":null,"provider_user_id":null,"code":null,"has_serial_number":"NO","name":"Indio","extra_name":null,"note_required":"NO","on_sale":"YES","availability_type":"ALWAYS","status":"ACTIVE","sort_weight":10,"description":null,"reference_price":0,"return_action":"RETURN_TO_STOCK","clave_sat":"01010101","measurement_unit":null,"unidad_medida_sat_id":"H87","created_by_user_id":null,"updated_by_user_id":null,"created":"2022-06-20T21:39:19.000Z","updated":"2023-04-12T17:06:57.000Z","image_style":"COVER","text_color":"#FFFFFF","text_style":"NEVER","shadow_color":"#000000","partial_sale":"NO","qty":0},"category":{"id":10,"name":"Cervezas","code":null,"default_clave_prod_serv":"01010101","type":"PRODUCT","sort_weight":10,"display_status":"NORMAL","image_id":106,"created_by_user_id":1,"updated_by_user_id":1,"created":"2022-06-07T16:28:21.000Z","updated":"2022-06-07T16:28:21.000Z","image_style":"CONTAIN","text_color":"HEADER_COLOR","text_style":"CENTER","shadow_color":"#000000","background":"transparent"},"records":[{"id":2568,"item_id":31,"purchase_detail_id":null,"order_item_id":2790,"store_id":4,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden","is_current":0,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-01-18T23:57:35.000Z","updated":"2023-05-15T19:50:20.000Z"},{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"}],"stock_record":{"id":4289,"item_id":31,"purchase_detail_id":null,"order_item_id":4900,"store_id":1,"shipping_item_id":null,"production_item_id":null,"serial_number_record_id":null,"previous_qty":1,"movement_qty":1,"qty":0,"description":"Se removio inventario por orden: 1571","is_current":1,"movement_type":"NEGATIVE","created_by_user_id":1,"updated_by_user_id":1,"created":"2023-07-19T00:16:07.000Z","updated":"2023-07-19T00:16:07.000Z"},"price":{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},"prices":[{"id":95,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":96,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":97,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":98,"tax_included":"YES","price_list_id":3,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":99,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":100,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":101,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":102,"tax_included":"YES","price_list_id":2,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":103,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":1,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":104,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":2,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":105,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":3,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"},{"id":106,"tax_included":"YES","price_list_id":1,"currency_id":"MXN","item_id":31,"percent":0,"price_type_id":4,"price":60,"created_by_user_id":1,"updated_by_user_id":null,"created":"2022-06-21T23:49:09.000Z","updated":"2022-06-21T23:49:09.000Z"}],"exceptions":[],"order_item_exceptions":[],"options":[],"serials":[],"serials_string":"","created":"2023-07-19T15:22:25.519Z","commanda_type_id":2}],"order":{"amount_paid":0,"ares":0,"billing_data_id":1,"cashier_user_id":1,"created":"2023-07-19T15:22:17.216Z","currency_id":"MXN","cancellation_reason":"","cancelled_by_user_id":null,"discount":0,"sat_isr":0,"sat_ieps":0,"discount_calculated":0,"price_type_id":1,"sat_serie":"A","sat_domicilio_fiscal_receptor":"","sat_regimen_fiscal_receptor":"","sat_regimen_capital_receptor":"","service_type":"QUICK_SALE","status":"PENDING","paid_status":"PENDING","store_id":1,"subtotal":258.62,"sync_id":"'+sync_id+'","table_id":null,"tag":"","tax":41.3792,"tax_percent":16,"total":300,"updated":"2023-07-19T15:22:17.216Z","version_created":"230715:1953-1253","version_updated":"230715:1953-1253","client_name":"PÚBLICO GRAL 08:23"},"structured_items":[],"delivery_user":null,"client":null,"offers":[]}',
	  "method": "POST",
	  "mode": "cors",
	  "credentials": "include"
	})
	.then((r)=>successAjax(r))
	.then((response)=>
	{
		//cierra la orden
		return Promise.all([
			fetch("http://127.0.0.1/PointOfSale/updates.php", {
	  			"headers": headers,
	  			"referrer": "http://127.0.0.1:4000/",
	  			"referrerPolicy": "strict-origin-when-cross-origin",
	  			"body": '{"order_id":'+response.order.id+',"method":"closeOrder"}',
	  			"method": "POST",
	  			"mode": "cors",
	  			"credentials": "include"
			}).then((r)=>successAjax(r)),
			Promise.resolve( response )
		]);
	})
	.then((values)=>{
		let order_info= values.pop();

		let body = JSON.stringify
		({
			"client_name":"nextor@gmail.com",
			"client_user_id":8,
			"id": order_info.order.id,
			"sat_codigo_postal":"22887",
			"sat_domicilio_fiscal_receptor":"22887",
			"sat_forma_pago":"99",
			"sat_ieps":0,
			"sat_isr":0,
			"sat_razon_social":"GRUPO JFTI SOLUCIONES",
			"sat_receptor_email":"integranet@integranet.xyz",
			"sat_receptor_rfc":"GJS1410232N4",
			"sat_regimen_capital_receptor":"SA de CV",
			"sat_regimen_fiscal_receptor":"626",
			"sat_serie":"A",
			"sat_uso_cfdi":"G03",
			"service_type":"QUICK_SALE",
			"billing_data_id": 1,
			"method":"updateDatosFacturacion"
		});
	
		//Actualiza datos de facturacion
		return Promise.all
		([
			fetch("http://127.0.0.1/PointOfSale/updates.php", {
	  			headers, body,
	  			"referrer": "http://127.0.0.1:4000/",
	  			"referrerPolicy": "strict-origin-when-cross-origin",
	  			"method": "POST",
	  			"mode": "cors",
	  			"credentials": "include"
			}).then((r)=>successAjax(r)),
			Promise.resolve( order_info)
		]);
//fetch("http://127.0.0.1/PointOfSale/updates.php", {
//  "headers": {
//    "accept": "application/json, text/plain, */*",
//    "accept-language": "en-US,en;q=0.9",
//    "authorization": "Bearer QGJVlIazhEbIGEsz",
//    "content-type": "application/json",
//    "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
//    "sec-ch-ua-mobile": "?0",
//    "sec-ch-ua-platform": "\"Linux\"",
//    "sec-fetch-dest": "empty",
//    "sec-fetch-mode": "cors",
//    "sec-fetch-site": "same-site"
//  },
//  "referrer": "http://127.0.0.1:4000/",
//  "referrerPolicy": "strict-origin-when-cross-origin",
//  "body": "{\"amount_paid\":240,\"ares\":0,\"billing_data_id\":1,\"cashier_user_id\":1,\"client_name\":\"PÚBLICO GRAL 08:23\",\"created\":\"2023-07-19T16:50:12.000Z\",\"currency_id\":\"MXN\",\"delivery_status\":\"DELIVERED\",\"discount\":0,\"discount_calculated\":0,\"facturacion_code\":\"C4A1AS7WSW\",\"facturado\":\"NO\",\"guests\":1,\"id\":1582,\"lat\":31.852771,\"lng\":-116.607177,\"marked_for_billing\":\"NO\",\"paid_status\":\"PARTIALLY_PAID\",\"price_type_id\":1,\"sat_codigo_postal\":\"22880\",\"sat_domicilio_fiscal_receptor\":\"22887\",\"sat_forma_pago\":\"01\",\"sat_ieps\":0,\"sat_isr\":0,\"sat_razon_social\":\"GRUPO JFTI SOLUCIONES\",\"sat_receptor_email\":\"test@integranet.xyz\",\"sat_receptor_rfc\":\"GJS1410232N4\",\"sat_regimen_fiscal_receptor\":\"626\",\"sat_serie\":\"A\",\"sat_uso_cfdi\":\"G03\",\"service_type\":\"QUICK_SALE\",\"shipping_cost\":0,\"status\":\"CLOSED\",\"store_consecutive\":1395,\"store_id\":1,\"subtotal\":258.6,\"sync_id\":\"8-1689785412484\",\"system_activated\":\"2023-07-19T16:50:12.000Z\",\"tax\":41.4,\"tax_percent\":16,\"total\":300,\"updated\":\"2023-07-19T16:50:12.000Z\",\"version_created\":\"230715:1953-1253\",\"version_updated\":\"230715:1953-1253\",\"method\":\"updateDatosFacturacion\"}",
//  "method": "POST",
//  "mode": "cors",
//  "credentials": "include"
//});
	})
	//.then((values)=>
	//{
	//	let order_info = values[1];
	//	return Promise.All
	//	([
	//		fetch("http://127.0.0.1/PointOfSale/payment_info.php", {
	//			headers,
	//			"referrer": "http://127.0.0.1:4000/",
	//			"referrerPolicy": "strict-origin-when-cross-origin",
	//			"body": '{"movements":[{"bank_movement":{"transaction_type":"CASH","client_user_id":null,"total":300,"amount_received":300,"origin_bank_name":null,"currency_id":"MXN","status":"ACTIVE","type":"income"},"bank_movement_orders":[{"currency_amount":300,"amount":300,"currency_id":"MXN","exchange_rate":1,"status":"ACTIVE","order_id":'+order_info.order.id+'}]}],"payment":{"type":"income","tag":"SALE","payment_amount":300,"received_amount":300,"facturado":"NO","sat_pdf_attachment_id":null,"sat_uuid":null,"sat_xml_attachment_id":null,"change_amount":0,"currency_id":"MXN","sync_id":'+pay_sync_id+'}}',
	//			"method": "POST",
	//			"mode": "cors",
	//			"credentials": "include"
	//		}).then((r)=>r.json())
	//		,Promise.resolve(order_info)
	//	]);
	//})
	.then((response)=>{
		let order_info = response.pop();
	
		return Promise.all
		([
			fetch("http://127.0.0.1/PointOfSale/facturacion_request.php", 
			{
	  			headers,
				"referrer": "http://127.0.0.1:4000/",
				"referrerPolicy": "strict-origin-when-cross-origin",
				"body": '{"facturacion_code":"'+order_info.order.facturacion_code+'","razon_social":"GRUPO JFTI SOLUCIONES","email":"integranet@integranet.xyz","rfc":"GJS1410232N4","domicilio_fiscal":"22887","regimen_fiscal":"626","regimen_capital":"626","uso_cfdi":"G03","version":"4.0"}',
				"method": "POST",
				"mode": "cors",
				"credentials": "include"
			}).then((r)=>successAjax(r)),
			Promise.resolve(order_info)
		]);
	})
	.then((response)=>
	{
		let order_info = response.pop();
	
		return Promise.all([
				fetch("http://127.0.0.1/PointOfSale/payment_info.php", {
				"headers": headers,
				"referrer": "http://127.0.0.1:4000/",
				"referrerPolicy": "strict-origin-when-cross-origin",
				"body": '{"movements":[{"bank_movement":{"transaction_type":"CASH","client_user_id":8,"total":300,"status":"ACTIVE","amount_received":300,"origin_bank_name":null,"currency_id":"MXN","type":"income"},"bank_movement_orders":[{"currency_amount":300,"amount":300,"currency_id":"MXN","status":"ACTIVE","exchange_rate":1,"order_id":'+order_info.order.id+'}]}],"payment":{"change_amount":0,"currency_id":"MXN","facturado":"NO","payment_amount":300,"received_amount":300,"sat_pdf_attachment_id":null,"sat_uuid":null,"sat_xml_attachment_id":null,"sync_id":"'+pay_sync_id+'","tag":"PAYMENT","type":"income"}}',
				"method": "POST",
				"mode": "cors",
				"credentials": "include"
			}).then((r)=>successAjax(r)),
			Promise.resolve( order_info )
		]);
	})
	.then((response)=>
	{
		let payment_info = response.shift();
		let order_info = response.shift();
	
		Promise.all([
			fetch("http://127.0.0.1/PointOfSale/updates.php", {
				headers,
				"referrer": "http://127.0.0.1:4000/",
				"referrerPolicy": "strict-origin-when-cross-origin",
				"body": '{"payment_id":'+payment_info.payment.id+',"method":"facturarPago"}',
				"method": "POST",
				"mode": "cors",
				"credentials": "include"
			}).then((r)=>r.json()),
			Promise.resolve( order_info )
		]);
	})
}

function successAjax(response)
{
	if( response?.ok )
		return response.json();

	if( response.status >= 200 && response.status < 300 )
		return response.json();

	throw 'Error con la respuesta: '+response.status+' : '+response.statusText;
}
