//Point Assessment - Test Harness (benc)
centerMap(-114,33,6);

//new approach

var fcSonora = ee.FeatureCollection('ft:1Ec8IWsP8asxN-ywSqgXWMuBaxI6pPaeh6hC64lA')
  .filter(ee.Filter.eq('ECO_NAME', 'Sonoran desert'));

var fcPointPoly = new ee.FeatureCollection([
    ee.Feature(
        ee.Feature.Polygon(
            [[-117, 35], [-112, 35], [-112, 28], [-117, 28]]))
    ]);

//take a collection of random points.  initialize the viz property to 0.
var points = ee.FeatureCollection.randomPoints({region:fcPointPoly, points:100});

print(points.getInfo());
var pointsBuf = points.map(function(f){return f.buffer(10000)});

var range = ee.Image('srtm90_v4').clip(fcSonora);
var refined = range.gte(400);
refined = refined.mask(refined);

//sum the values under the buffered points.  any sums > 0 intersect the range map
var inExpRange0 = range.reduceRegions(pointsBuf,ee.Reducer.histogram(),1000);
                          //.filter(ee.Filter.gt('sum',0));
//inExpRange0 = inExpRange0.map(function(f) {
//                return f.set({'inExp': 1});
//              });
print(inExpRange0.getInfo());              
var inExpRange = inExpRange0.aggregate_count('sum');


var inRefRange = refined.reduceRegions(pointsBuf,ee.Reducer.sum(),1000)
              .filter(ee.Filter.gt('sum',0)).aggregate_count('sum');

var inExp = inExpRange.getInfo();
var inRef = inRefRange.getInfo();
print("In expert: " + inExp);
print("In refined: " + inRef);
print("In expert range but not in refined range: " + (inExp - inRef));

addToMap(range,{palette:"4C7A01"});
addToMap(refined,{palette:"05A351"});
addToMap(pointsBuf);
addToMap(points);
