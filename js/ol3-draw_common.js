var placeid = '0';
var floorid = '01';// 楼层编号    选择楼层

var placeType = 'null';// 区域名称
var tableType = 'null' // 表名

var DBs = 'mote'; //数据源
// var comIp = 'http://101.81.226.116:9080';
var comIp = 'http://114.215.83.3:8090';
var wfsUrl = comIp + '/geoserver/wfs';
var wmsUrl = comIp + '/geoserver/' + DBs + '/wms';

var geomPlaces;
var geomBackgrounds = {};
var geomPolygons = {};
var geomPolylines = {};
var geomPOIs = {};

// 设置视图
var view = new ol.View({
	center: [121.4286933,31.1664993],
	projection: 'EPSG:4326',
	zoom: 19
});

// 室内图数据获取 	
var geojsonObject = function(filter,Typename){
	var geojson = {};
	$.ajax({
		url: wfsUrl,
		data: {
			service: 'WFS',
			version: '1.1.0',
			request: 'GetFeature',
			typename: DBs + Typename,
			outputFormat: 'application/json',
			cql_filter: filter
		},
		type: 'GET',
		dataType: 'json',	
		async: false,
		success: function(response){
			var features = new ol.format.GeoJSON().readFeatures(response);
			var floorLength = features.length;
			if(floorLength > 0){
				for(var i=0;i<features.length;i++){
					var featuresFloor = features[i].get('floor_id');
					if(geojson[featuresFloor] == undefined){
						geojson[featuresFloor] = [];
					}
					geojson[featuresFloor].push(features[i]);
				}	
			}
		}
	});
	// 返回经过条件筛选后的数据
	return geojson; 
};
/* get 室内图 */
function getGeomData(){
	geomBackgrounds = geojsonObject('place_id='+placeid,':polygon_background');
	geomPolygons = geojsonObject('place_id='+placeid,':polygon');
	geomPolylines = geojsonObject('place_id='+placeid,':polyline');
	geomPOIs = geojsonObject('place_id='+placeid,':point');
}

//获取所有place
var getGeomPlaces = function(Typename){
	var geojson = [];
	$.ajax({
		url: wfsUrl,
		data: {
			service: 'WFS',
			version: '1.1.0',
			request: 'GetFeature',
			typename: DBs + Typename,
			outputFormat: 'application/json',
		},
		type: 'GET',
		dataType: 'json',	
		async: false,
		success: function(response){
			geojson = new ol.format.GeoJSON().readFeatures(response);
		}
	});
	return geojson; 
};
geomPlaces = getGeomPlaces(':polygon_background');

function loadDBplace(){
	var palceTag = [];
	var placeLength = geomPlaces.length;

	palceTag[0] = '<option value="null">请选择区域</option>';
	for (var Num =0;Num < placeLength;Num++){
		palceTag[Num+1] = '<option value="'+geomPlaces[Num].get('place_id')+'">'+geomPlaces[Num].get('name')+'</option>';
	}
	palceTag[placeLength+1] = '<option value="newplace">新增区域</option>';

	$("#db-place").append(palceTag);
}
//获取中心点
var mapCenter = function(placeId){
	var placeLength = geomPlaces.length;
	var places = 0,placeLonSum = 0,placeLatSum = 0;
	for (var placeNum =0;placeNum < placeLength;placeNum++){
		if (geomPlaces[placeNum].get('place_id') == placeId){
			placeLonSum += geomPlaces[placeNum].getGeometry().getInteriorPoint().getCoordinates()[0];
			placeLatSum += geomPlaces[placeNum].getGeometry().getInteriorPoint().getCoordinates()[01];
			places ++;
		}
	}
	return [placeLonSum/places,placeLatSum/places];
}

// 室内图样式设置
var geojsonstylefunction = function(feature){
	// var featureiiiid = feature.I.feature_id;
	var featureiiiid = feature.values_.feature_id;
	var featureangle = feature.values_.angle = null ? 0: feature.values_.angle;
	if (feature.getGeometry().getType() == 'Point'  && (featureiiiid == '30060300' || featureiiiid == '30060000' || featureiiiid == '30040100')){
		// geojsonstyle[featureiiiid].getText().setText(feature.I.name);
		geojsonstyle[featureiiiid].getText().setText(feature.values_.name);
	}
	if (featureiiiid == '30060100' || featureiiiid == '30060200' ){
		if (map.getView().getZoom() > 19){
			geojsonstyle[featureiiiid].getImage().setScale((map.getView().getZoom()-19)*0.1);
		}else {
			geojsonstyle[featureiiiid].getImage().setScale(0.1);
		}
		geojsonstyle[featureiiiid].getImage().setRotation(featureangle);
	}
	if (featureiiiid == '30050100' || featureiiiid == '30050800' || featureiiiid == '30050200' || featureiiiid == '30050300' ){
		if (map.getView().getZoom() > 18){
			geojsonstyle[featureiiiid].getImage().setScale((map.getView().getZoom()-18)*0.06);
		}else {
			geojsonstyle[featureiiiid].getImage().setScale(0.1);
		}
	}
	
	if (featureiiiid == undefined)  {
		var geomType = feature.getGeometry().getType();
		switch(geomType){
			case 'Point':
				return geojsonstyle[30999999];	
				break;
			case 'LineString':
				return geojsonstyle[20020900];	
				break;
			case 'Polygon':
				return geojsonstyle[10030602];	
				break;			
		}
	}else {
		// 返回数据的style
		return geojsonstyle[featureiiiid];		
	}
};

// 电子围栏样式设置
var electronicFenceStyleFun = function(feature){
	// var featureiiiid = feature.values_.type_id;
	var featureiiiid = '1';
	// 返回数据的style
	return electronicFenceStyle[featureiiiid];
};

// 测距
var formatLength; // 计算线的长度
var getLength; // 计算线的长度(不带单位)
var wgs84Sphere = new ol.Sphere(6378137); // 计算线的长度所用常量
var sketch; // 绘制的形状
var measureTooltipElement; // 显示长度
var measureTooltips = [];//显示长度的overlay 
var measureNum=0; // 长度的overlay 计数

// 编辑
var newFeature = null;
var newdrawNum;
var electronicLayerOff = true; // 显示电子围栏的FLAG 当为true时显示电子围栏图层
var drawFlag = false;
var drawtype = null;   // add or upd or rm
var FeatureColumnFlag = false; // 绘制的形状的属性flag
var DrawFeature; // 绘制的interaction  draw
var ModifyFeature; // 修改的interaction  select and modify
var DeleteFeature; // 删除的interaction  select
var FeatureDummy =[]; // 电子围栏的feature 临时存储

// 修改记录
function updateNewFeature(features,featureType,updType){
	var WFSTSerializer = new ol.format.WFS();
    var formatGML = new ol.format.GML({  
		featureNS: 'http://www.' + DBs + '.com',
		featurePrefix: DBs,
        featureType: featureType,
        srsName: 'EPSG:4326',
    }); 	
	var featObject;
	switch (updType) {  
		case 'insert': 
			featObject = WFSTSerializer.writeTransaction(features,null,null,formatGML);
			break;
		case 'update': 
			featObject = WFSTSerializer.writeTransaction(null,features,null,formatGML);
			break;
		case 'remove': 
			featObject = WFSTSerializer.writeTransaction(null,null,features,formatGML);
			break;
	}
	var serializer = new XMLSerializer();
	var featString = serializer.serializeToString(featObject);
	featObjectSend(featString);
	console.log(featString);
}

// 发送操作数据库请求
function featObjectSend(featString){
	var request = new XMLHttpRequest();
	request.open('POST', wfsUrl + '?service=wfs');
	request.setRequestHeader('Content-Type', 'text/xml');
	request.send(featString);		
}

// Draw END
var drawstyle = new ol.style.Style({
    fill: new ol.style.Fill({
		color: 'rgba(255,0, 0, 1)'
    }),
    stroke: new ol.style.Stroke({
		color: '#ffcc33',
		width: 2
    }),
    image: new ol.style.Circle({
		radius: 7,
		fill: new ol.style.Fill({
			color: '#ffcc33'
		})
	}),
	zIndex: 500
});
var drawpointstyle = new ol.style.Style({
    image: new ol.style.Circle({
		radius: 4,
		stroke: new ol.style.Stroke({
			color: '#ffcc33',
			width: 1.5
		}),
		fill: new ol.style.Fill({
			color: '#ffffff'
		})
	}),
	zIndex: 500
});
	
// 电子围栏 1-4 系数越大颜色越深
var electronicFenceStyle = {
	// polygon
	'1' /*黄*/: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [255,255,0,1],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [255,255,0,0.3]
		})
	}),
	'2' /*橙*/: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [250,128,10,1],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [250,128,10,0.3],
		})
	}),
	'3' /*红*/: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [255,0,0,1],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [255,0,0,0.3]
		})
	}),
	'4' /*紫*/: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [255,0,255,1],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [255,0,255,0.3]
		})
	}),
	// point
	'11' /*黄*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/electronic1.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [255,255,0,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:300
	}),	
	'22' /*橙*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/electronic2.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [250,128,10,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:300
	}),		
	'33' /*红*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/electronic3.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [255,0,0,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:300
	}),		
	'44' /*紫*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/electronic4.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [255,0,255,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:300
	})
};
	
// 基础图层style
var geojsonstyle = {
	'999999' : new ol.style.Style({
		fill: new ol.style.Fill({
			color: [200,200,200,1]
		}),
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width:1
		}),
		zIndex: 100
	}),
	/************
	*
	*polygon
	*
	************/
	'10020511'/*公司范围*/: new ol.style.Style({ 
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [255,255,255,1]
		}),
		zIndex:101
	}),
	'10020401'/*教室*/: new ol.style.Style({ 
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width:1
		}),
		fill: new ol.style.Fill({
			color: [255,255,255,1]
		}),
		zIndex:101
	}),
	'10030501'/*总裁*/: new ol.style.Style({ 
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [204,153,255,0.5]
		}),
		zIndex:102
	}),
	'10030502' /*财务室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex:102
	}),
	'10030503' /*涉密机房*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [255,153,0,0.5]
		}),
		zIndex:102
	}),
	'10030504' /*会议室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [255,255,204,0.5]
		}),
		zIndex:102
	}),
	'10030505' /*办公桌*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [108,94,80,0.8]
		}),
		zIndex: 103
	}),
	'10030506' /*技术总监*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [220,220,255,0.5]
		}),
		zIndex: 103
	}),
	'10030507' /*市场部*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030508' /*综合部*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030509' /*质量部*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030510' /*商务部*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030511' /*人力资源*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030512' /*项目管理*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030513' /*地图办公室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [233,242,239,0.5]
		}),
		zIndex: 103
	}),
	'10030514' /*总经理室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [220,220,255,0.5]
		}),
		zIndex: 103
	}),
	'10030515' /*副总经理室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [220,220,255,0.5]
		}),
		zIndex: 103
	}),
	'10030516' /*经理*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [220,220,255,0.5]
		}),
		zIndex: 103
	}),
	'10030517' /*资料室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [252,231,212,0.5]
		}),
		zIndex: 103
	}),
	'10030518' /*技术服务*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [252,231,212,0.5]
		}),
		zIndex: 103
	}),
	'10030519' /*打印室*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [252,231,212,0.5]
		}),
		zIndex: 103
	}),
	'10030520' /*设备间*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [252,231,212,0.5]
		}),
		zIndex: 103
	}),
	'10030599' /*其他*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [252,231,212,0.5]
		}),
		zIndex: 103
	}),
	// '10030101' /*看板*/: new ol.style.Style({  
		// stroke: new ol.style.Stroke({
			// color: [128,128,128,0.6],
			// width: 1
		// }),
		// fill: new ol.style.Fill({
			// color: [255,153,204,0.8]
		// }),
		// zIndex: 103
	// }),
	'10030602' /*卫生间*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [255,153,204,0.5]
		}),
		zIndex:103
	}),
	'10030603' /*沙发*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [204,204,104,0.8]
		}),
		zIndex: 103
	}),
	'10030604' /*电梯间*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [180,180,180,0.5]
		}),
		zIndex:102
	}),
	'10030605' /*楼梯间*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 0.8
		}),
		fill: new ol.style.Fill({
			color: [180,180,180,0.5]
		}),
		zIndex:102
	}),
	'10030606' /*书架*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [224,224,224,0.8]
		}),
		zIndex: 103
	}),
	'10030607' /*机柜*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [104,104,104,0.8]
		}),
		zIndex: 103
	}),
	'10030608' /*资料架*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [224,224,224,0.8]
		}),
		zIndex: 103
	}),
	'10030609' /*衣柜*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [204,204,204,0.8]
		}),
		zIndex: 103
	}),
	'10030610' /*床*/: new ol.style.Style({  
		stroke: new ol.style.Stroke({
			color: [128,128,128,0.6],
			width: 1
		}),
		fill: new ol.style.Fill({
			color: [244,244,204,0.8]
		}),
		zIndex: 105
	}),


	/************
	*
	*polyline
	*
	************/
	'20020900'/*道路*/: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [208,128,128,0.6],
			width: 0.8
		}),
		zIndex:200	
	}),
	/************
	*
	*point
	*
	************/
	'30060000' /*公司名*/: new ol.style.Style({  
		text: new ol.style.Text({
			font: '1em sans-serif',
			// scale: 100,
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [40,40,40,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 3
			})
		}),
		zIndex:350
	}),	
	'30060100' /*工位*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/chair_right.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		zIndex:300
	}),
	'30060200' /*工位*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/chair_left.png',
			anchor: [0.5,0.5],
			rotateWithView: true
		}),
		zIndex:300
	}),	
	'30060300' /*会议室&财务室&公共办公区&总经理室*/: new ol.style.Style({  
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			// scale: 100,
			textAlign: 'center',
			textBaseline: 'bottom',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [40,40,40,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:340
	}),
	'30040100' /*教室*/: new ol.style.Style({  
		text: new ol.style.Text({
			font: '0.61em sans-serif',
			// scale: 100,
			textAlign: 'center',
			textBaseline: 'middle',
			offsetY: -5,
			fill: new ol.style.Fill({
				color: [40,40,40,1]
			}),
			stroke: new ol.style.Stroke({
				color: [255,255,255,1],
				width: 1
			})
		}),
		zIndex:340
	}),
	'30050100' /*卫生间*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/wc.png',
		}),
		zIndex:330
	}),	
	'30050200' /*楼梯*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/stair.png',
		}),
		zIndex:330
	}),	
	'30050300' /*电梯*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/elevator.png',
		}),
		zIndex:330
	}),	
	'30050800' /*大门*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/door.png',
		}),
		zIndex:330
	}),			
	'30052200' /*床*/: new ol.style.Style({  
		image: new ol.style.Icon({
			src: './icon/bed.png',
		}),
		zIndex:330
	}),	
	
	'30999999' /*绘制 临时*/: new ol.style.Style({  
		image: new ol.style.Circle({
			radius: 4,
			stroke: new ol.style.Stroke({
				color: '#ffcc33',
				width: 1.5
			}),
			fill: new ol.style.Fill({
				color: '#ffffff'
			})
		}),
		zIndex:330
	}),	
	
};


var amapLayer = new ol.layer.Tile({
	title: '高德地图',
	visible: true,
	source: new ol.source.XYZ({
		url: 'http://webst0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
	}),
	zIndex: 0
});

var viewParam = 'place_id:' + placeid + ';floor_id:' + floorid;
var backgroundTypename = DBs + ':mote_background';
var backgroundLayer = new ol.layer.Vector({
	title: 'background map',
	visible: true,
	// source: new ol.source.Vector({
		// features:  new ol.format.GeoJSON().readFeatures(geojsonObject(viewParam,backgroundTypename))
	// }),
	source: new ol.source.Vector(),
	style: geojsonstylefunction,
	maxResolution: 0.00001,
	zIndex: 1
});
// 2D
var polygonTypename = DBs + ':mote_polygon';
var polygonLayer = new ol.layer.Vector({
	title: 'polygon map',
	visible: true,
	// source: new ol.source.Vector({
		// features:  new ol.format.GeoJSON().readFeatures(geojsonObject(viewParam,polygonTypename))
	// }),
	source: new ol.source.Vector(),
	style: geojsonstylefunction,
	maxResolution: 0.00001,
	zIndex: 10
});
// 2D
var polylineTypename = DBs + ':mote_polyline';
var roadLayer = new ol.layer.Vector({
	title: 'polyline map',
	visible: true,
	// source: new ol.source.Vector({
		// features:  new ol.format.GeoJSON().readFeatures(geojsonObject(viewParam,polylineTypename))
	// }),
	source: new ol.source.Vector(),
	style: geojsonstylefunction,
	maxResolution: 0.00001,
	zIndex: 20
});

var pointTypename = DBs + ':mote_point';
var pointLayer = new ol.layer.Vector({
	title: 'point map',
	visible: true,
	// source: new ol.source.Vector({
		// features:  new ol.format.GeoJSON().readFeatures(geojsonObject(viewParam,pointTypename))
	// }),
	source:new ol.source.Vector(),
	style: geojsonstylefunction,
	maxResolution: 0.000003,
	zIndex: 30
});

// 电子围栏图层 	
var electronicLayer = new ol.layer.Vector({
	title: 'electronicFence map',
	visible: true,
	style: electronicFenceStyleFun,
	source: new ol.source.Vector(),
	zIndex: 80
});		

// common
var place = "<div class='input-group has-feedback' id='place'>" +
	"<span class='input-group-addon' id='place_key'>区域编号</span>" +
	"<input class='form-control' id='place_value'>"+
	"<a class='btn close form-control-feedback' id='clear_place' onclick='clear_column(this);' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";
var feature = "<div class='input-group has-feedback' id='feature'>" +
	"<span class='input-group-addon' id='feature_key'>要素编号</span>" +
	"<input class='form-control' id='feature_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_feature' onclick='clear_column(this);' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";
var floor = "<div class='input-group has-feedback' id='floor'>" +
	"<span class='input-group-addon' id='floor_key'>楼层编号</span>" +
	"<input class='form-control' id='floor_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_floor' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";
var Fname = "<div class='input-group has-feedback' id='Fname'>" +
	"<span class='input-group-addon' id='name_key'>要素名称</span>" +
	"<input class='form-control' id='name_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_name' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";
var stime = "<div class='input-group has-feedback' id='stime'>" +
	"<span class='input-group-addon' id='stime_key'>开始时间</span>" +
	"<input class='form-control' id='stime_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_stime' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";	
var etime = "<div class='input-group has-feedback' id='etime'>" +
	"<span class='input-group-addon' id='etime_key'>结束时间</span>" +
	"<input class='form-control' id='etime_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_etime' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";

// 电子围栏
var electronic_type = "<div class='input-group has-feedback' id='electronic_type'>" +
	"<span class='input-group-addon' id='electronic_type_key'>围栏等级</span>" +
	"<input class='form-control' id='electronic_type_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_electronic_type' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";

// point
var node = "<div class='input-group has-feedback' id='node'>" +
	"<span class='input-group-addon' id='node_key'>换楼层码</span>" +
	"<input class='form-control' id='node_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_node' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";	
var cnodeu = "<div class='input-group has-feedback' id='cnodeu'>" +
	"<span class='input-group-addon' id='cnodeu_key'>上楼位置</span>" +
	"<input class='form-control' id='cnodeu_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_cnodeu' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";	
var cnoded = "<div class='input-group has-feedback' id='cnoded'>" +
	"<span class='input-group-addon' id='cnoded_key'>下楼位置</span>" +
	"<input class='form-control' id='cnoded_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_cnoded' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";		
var angle = "<div class='input-group has-feedback' id='angle'>" +
	"<span class='input-group-addon' id='angle_key'>旋转角度</span>" +
	"<input class='form-control' id='angle_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_angle' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";		
var lonlat = "<div class='input-group has-feedback' id='lonlat'>" +
	"<span class='input-group-addon' id='lonlat_key'>坐标</span>" +
	"<input class='form-control' id='lonlat_value'>"+
"</div>";	

// polygon
var penup = "<div class='input-group has-feedback' id='penup'>" +
	"<span class='input-group-addon' id='penup_key'>PenUp</span>" +
	"<input class='form-control' id='penup_value'>"+
	"<a class='btn close form-control-feedback'  id='clear_penup' style='pointer-events: auto'><span aria-hidden='true'>&times;</span></a>"+
"</div>";	