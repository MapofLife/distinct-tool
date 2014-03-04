//Point Assessment - Test Harness (benc)
//github.com/MapofLife/forest-tool/blob/master/playground/point_assess_test.js
centerMap(-114,33,7);

var fcSonora = ee.FeatureCollection('ft:1Ec8IWsP8asxN-ywSqgXWMuBaxI6pPaeh6hC64lA')
  .filter(ee.Filter.eq('ECO_NAME', 'Sonoran desert'));

var fcPointPoly = new ee.FeatureCollection([
    ee.Feature(
        ee.Feature.Polygon(
            [[-117, 35], [-112, 35], [-112, 28], [-117, 28]]))
    ]);

//take a collection of random points.
var points = ee.FeatureCollection.randomPoints({region:fcPointPoly, points:25});

//buffer points by 10km
var pointsBuf = points.map(function(f){return f.buffer(10000)});

/////
// create the range and refined range
/////

var range = ee.Image('srtm90_v4').clip(fcSonora);

//take only values greater than 400m.  Number is arbitrary just to create a range map
var refined = range.gte(400); 
refined = refined.mask(refined);

//we need to set up the data so that range has 1, refined has 2
//this code seems pretty hacky, there must be a better way
range = range.subtract(range); //set up range so that its 0
range = range.add(1); //now add one 
//refined is masked so we can't just add.  instead set to 2 where its currently 1
refined = refined.where(refined.eq(1),2); 

//rename bands to something more descriptive
range = range.select(['elevation'],['habitat']);
refined = refined.select(['elevation'],['habitat']);

var allrange = ee.ImageCollection.fromImages([range,refined])
                  .reduce(ee.Reducer.max())
                  .mask(ee.Image(1));

////
// run the analysis
////

//now we have the layer that has 1 for original range and 2 for refined range
//use reduce regions with the buffered points to find the maxim pixel
var pointsBufMax = allrange.reduceRegions(pointsBuf,ee.Reducer.max(),1000);

//filter results
var outRange = pointsBufMax.filter(ee.Filter.eq('max',0));
var inExpOutRef = pointsBufMax.filter(ee.Filter.eq('max',1));
var inRef = pointsBufMax.filter(ee.Filter.eq('max',2));

////
// output results
////
print('Outside range: ' + outRange.aggregate_count('max').getInfo());              
print('Inside range but outside refined range: ' + inExpOutRef.aggregate_count('max').getInfo()); 
print('Inside refined range: ' + inRef.aggregate_count('max').getInfo()); 

addToMap(allrange.clip(fcSonora),{palette:"000000,9BF2F2,52238C",min:0,max:2},"All Range");

//comment any two of these and there will be no Tile errors
addToMap(outRange.draw('9C031D',3,0),{},"Outside range");
addToMap(inExpOutRef.draw('FACB0F',3,0),{},"Inside range outside refined range");
addToMap(inRef.draw('800000',3,0),{},"Inside refined range");

//addToMap(pointsBufMax,{},"Buffers");
addToMap(points,{},"Points");
