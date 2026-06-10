var alos = ee.Image('JAXA/ALOS/AW3D30/V2_2');
Map.centerObject(OFvector,13);
// Create an empty image into which to paint the features, cast to byte.
var empty = ee.Image().byte();

// Paint all the polygon edges with the same number and width, display.
var outline = empty.paint({
  featureCollection: OFvector,
  color: 1,
  width: 3
});
Map.addLayer(outline, {palette: 'FF0000'}, 'edges');

// Define a function that scales and masks Landsat 8 surface reflectance images.
function prepSrL8(image) {
  // Develop masks for unwanted pixels (fill, cloud, cloud shadow).
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var getFactorImg = function(factorNames) {
    var factorList = image.toDictionary().select(factorNames).values();
    return ee.Image.constant(factorList);
  };
  var scaleImg = getFactorImg([
    'REFLECTANCE_MULT_BAND_.|TEMPERATURE_MULT_BAND_ST_B10']);
  var offsetImg = getFactorImg([
    'REFLECTANCE_ADD_BAND_.|TEMPERATURE_ADD_BAND_ST_B10']);
  var scaled = image.select('SR_B.|ST_B10').multiply(scaleImg).add(offsetImg);

  // Replace original bands with scaled bands and apply masks.
  return image.addBands(scaled, null, true)
    .updateMask(qaMask).updateMask(saturationMask);
}

// Make a cloud-free Landsat 8 surface reflectance composite.
var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterDate('2020-01-01', '2022-12-31')
  .filter(ee.Filter.calendarRange(1,6,'month'))
  .filter(ee.Filter.bounds(OFvector))
  .map(prepSrL8)
  .select('SR.*');

var composite = image.median();

var addIndices = function(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename(['ndvi']);
  var ndwi = image.normalizedDifference(['SR_B3', 'SR_B5']).rename(['ndwi']);
  var evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': image.select('SR_B5'),
      'RED': image.select('SR_B4'),
      'BLUE': image.select('SR_B2')
}).rename(['evi']);
 var bsi = image.expression(
      '(( X + Y ) - (A + B)) /(( X + Y ) + (A + B)) ', {
        'X': image.select('SR_B6'), //swir1
        'Y': image.select('SR_B4'),  //red
        'A': image.select('SR_B5'), // nir
        'B': image.select('SR_B2'), // blue
  }).rename('bsi');
  return image.addBands(ndvi).addBands(ndwi).addBands(evi).addBands(bsi);
};
var composite = addIndices(composite);

// Calculate Slope and Elevation
var elev = alos.select('AVE_DSM').rename('elev');
var slope = ee.Terrain.slope(alos.select('AVE_DSM')).rename('slope');

var composite = composite.addBands(elev).addBands(slope);

var visParams = {bands: ['SR_B4', 'SR_B3', 'SR_B2'],min:0.01792374999999999, max:0.13532125};
Map.addLayer(composite.clip(OFvector), visParams, 'RGB');

var NDVIlayer = composite.select('ndvi');
var clipNDVI = NDVIlayer.clip(OFvector);
Map.addLayer(NDVIlayer.clip(OFvector),{palette:['black','yellow','orange','red','limegreen','green'],min:-0.022853436809532796,max:0.8660370302729875},'NDVI');
Map.addLayer(clipNDVI.gt(0.80).selfMask(),{palette:['cyan']},'high NDVI');


// Normalize the image 

// Machine learning algorithms work best on images when all features have
// the same range

// Function to Normalize Image
// Pixel Values should be between 0 and 1
// Formula is (x - xmin) / (xmax - xmin)
//************************************************************************** 
function normalize(image){
  var bandNames = image.bandNames();
  // Compute min and max of the image
  var minDict = image.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: OFvector,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 16
  });
  var maxDict = image.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: OFvector,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 16
  });
  var mins = ee.Image.constant(minDict.values(bandNames));
  var maxs = ee.Image.constant(maxDict.values(bandNames));

  var normalized = image.subtract(mins).divide(maxs.subtract(mins));
  return normalized;
}

var composite = normalize(composite);

var landcover2020 = forest.merge(sparse_vegetation).merge(bare_ground).merge(artificial_surfaces).merge(cropland);
var gcp2020 = landcover2020.randomColumn();
var trainingGcp2020 = gcp2020.filter(ee.Filter.lt('random', 0.7));
var validationGcp2020 = gcp2020.filter(ee.Filter.gte('random', 0.7));
// Overlay the point on the image to get training data.
var training = composite.sampleRegions({
  collection: trainingGcp2020,
  properties: ['landcover'],
  scale: 10,
  tileScale: 16
});
//print(training);

// Train a classifier.
var classifier = ee.Classifier.smileRandomForest(200)
.train({
  features: training,  
  classProperty: 'landcover',
  inputProperties: composite.bandNames()
});



// Classify the image.
var classified = composite.classify(classifier);
var palette = ['#004d40', '#ffc107', '#1e88e5', 'red','purple'];
Map.addLayer(classified.clip(OFvector), {min: 1, max: 5, palette: palette}, '2020');

var test2020 = classified.sampleRegions({
  collection: validationGcp2020,
  properties: ['ID'],
  tileScale: 16,
  scale: 30
});

var testAccuracy2020 = test2020.errorMatrix('ID', 'classification');
print('Validation error matrix for 2020: ', testAccuracy2020);
print('Validation overall accuracy for 2020: ', testAccuracy2020.accuracy());

//Area calculation for urban areas in 2020
var urbanArea = classified.eq(4).selfMask();
var urbanAreaFinal = urbanArea.clip(OFvector);
Map.addLayer(urbanAreaFinal,{palette:['red']},'Urban Area 2020');

var urbanAreaTotalArea = urbanAreaFinal.multiply(ee.Image.pixelArea()).divide(10000)
var area = urbanAreaTotalArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: OFvector,
  scale: 30,
  maxPixels: 1e13
  })
  
print('total area of artificial \n surface in 2020: ',area, ' hectares');

//Area calculation for forest areas in 2020
var forestArea = classified.eq(1).selfMask();
var forestAreaFinal = forestArea.clip(OFvector);
Map.addLayer(forestAreaFinal,{palette:['green']},'Forest Area 2020');

var forestAreaTotalArea = forestAreaFinal.multiply(ee.Image.pixelArea()).divide(10000)
var area1 = forestAreaTotalArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: OFvector,
  scale: 30,
  maxPixels: 1e13
  })
  
print('total area of forested \n landscapes in 2020: ',area1, ' hectares');

//Area calculation for sparse vegetation areas in 2020
var sparseArea = classified.eq(2).selfMask();
var sparseAreaFinal = sparseArea.clip(OFvector);
Map.addLayer(sparseAreaFinal,{palette:['orange']},'Sparse Vegetation Area 2020');

var sparseAreaTotalArea = sparseAreaFinal.multiply(ee.Image.pixelArea()).divide(10000)
var area2 = sparseAreaTotalArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: OFvector,
  scale: 30,
  maxPixels: 1e13
  })
  
print('total area of sparse \n vegetation landscapes in 2020: ',area2, ' hectares');

//Area calculation for bareground areas in 2020
var bareArea = classified.eq(3).selfMask();
var bareAreaFinal = bareArea.clip(OFvector);
Map.addLayer(bareAreaFinal,{palette:['orange']},'Bare Area 2020');

var bareAreaTotalArea = bareAreaFinal.multiply(ee.Image.pixelArea()).divide(10000)
var area3 = bareAreaTotalArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: OFvector,
  scale: 30,
  maxPixels: 1e13
  })
  
print('total area of \n bare area in 2020: ',area3, ' hectares');

//Area calculation for cropland areas in 2020
var cropArea = classified.eq(5).selfMask();
var cropAreaFinal = cropArea.clip(OFvector);
Map.addLayer(cropAreaFinal,{palette:['orange']},'Crop Area 2020');

var cropAreaTotalArea = cropAreaFinal.multiply(ee.Image.pixelArea()).divide(10000)
var area4 = cropAreaTotalArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: OFvector,
  scale: 30,
  maxPixels: 1e13
  })
  
print('total area of cropland \n area in 2020: ',area4, ' hectares');

Export.image.toDrive({
  image: classified,
  description: 'QUINALI_2020',
  scale: 30,
  region: OFvector,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
