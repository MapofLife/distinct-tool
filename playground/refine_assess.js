//refine_assess
//https://github.com/MapofLife/forest-tool/blob/master/playground/refine_assess.js
centerMap(-112,40, 4);

//SET VAR INPUT PARAMETERS
var forestCoverLow = 0; //greater than this
var forestCoverHigh = 100; //less than this
var elevationLow = 1800; //greater than
var elevationHigh = 20000; //less than

var prefs = [0,1,2,3,4,5,6,7,8,9]; //use to select which habitat prefs.  this will be passed in by the user

//maps engine id's for the assests.  there should be a total of 12, only using 4 right now.
var modis_binary = {
  0:'04040405428907908306-03680284325645907752',
  1:'04040405428907908306-12923493437973401200',
  2:'04040405428907908306-16898429718931540991',
  3:'04040405428907908306-16395992718068236206',
  4:'04040405428907908306-15358274840329672602',
  5:'04040405428907908306-12698644595759757371',
  6:'04040405428907908306-12477440792896460579',
  7:'04040405428907908306-15698256553179772670',
  8:'04040405428907908306-06780301927403350898',
  9:'04040405428907908306-14332696666181097875',
  10:'04040405428907908306-16447721153088195693',
  11:'04040405428907908306-06713643388870702562',
  12:'04040405428907908306-07640583113864798358',
  13:'04040405428907908306-03630102749481522798',
  14:'04040405428907908306-17836853509917069823',
  15:'04040405428907908306-10234291591537811114',
  16:'04040405428907908306-04479792456830051410'
};

//make a bunch of points. in the web app these will be passed in.
var fcPointPoly = new ee.FeatureCollection([
    ee.Feature(
        ee.Feature.Polygon(
            [[-110, 50], [-90, 50], [-90, 20], [-110, 20]]))
    ]);

//take a collection of random points and buffer.
var points = ee.FeatureCollection.randomPoints({region:fcPointPoly, points:25});
var pointsBuf = points.map(function(f){return f.buffer(10000)}); //buffer by 10km

//Abeomelomys_sevia range 04040405428907908306-04550633376616161003 centerMap(144.86572,-5.92204, 4);
//Chrysothlypis_chrysomelas (Black-And-Yellow Tanager) 04040405428907908306-07422276925927616232 centerMap(-80,7, 6);
//Heterodon nasicus (Nasicus) 04040405428907908306-09733671023748783803
var range =  ee.Image('GME/images/04040405428907908306-09733671023748783803');
var forest = ee.Image('GME/images/04040405428907908306-09310201000644038383')
                .divide(100); //need to divide by 100 then we get two digit %
var elev = ee.Image('GME/images/04040405428907908306-08319720230328335274');
var habitat = ee.Image(0); //initialize habitat image

//make the landcover layer by merging modis layers for each of the habitat preferences
for(var i=0; i<prefs.length; i++) {
  habitat = habitat.add(ee.Image('GME/images/' + modis_binary[prefs[i]]).mask(range));
}

//this will need to change, if we consider % forest cover in a more complex way.  good enough for now though
habitat = habitat.gte(1)//since we are just adding all the habitat layers, we might end up with pixels > 1
            .where(forest.lt(forestCoverLow).or(forest.gt(forestCoverHigh)),0); //remove all pixels outside the bounds of forest cover
// don't know why but elevation layer is giving me errors right now
//            .where(elev.lt(elevationLow).or(elev.gt(elevationHigh)),0); //remove all pixels outside the bound of elevation

//we need a surface that has:
// 0 outside the original range, 
// 1 in the expert range but outside refined range, and 
// 2 in refined range
//need to use the method below so that we can ensure there are no masked out value, which
//messes up the reducer
var allrange = ee.Image(0)
        .where(range.eq(1), 1)
        .where(habitat.eq(1), 2);

//now we have the layer that has 1 for original range and 2 for refined range
//use reduce regions with the buffered points to find the maxim pixel
var pointsBufMax = allrange.reduceRegions(pointsBuf,ee.Reducer.max(),1000);

// Count the results with a histogram.
// Note, 0, 1 and 2 just happen to occur in the 0th, 1st and 2nd position.
var hist = pointsBufMax.reduceColumns(ee.Reducer.histogram(), ['max']).getInfo();

print('Outside range: ' + hist.histogram.histogram[0]);              
print('Inside range but outside refined range: ' + hist.histogram.histogram[1]); 
print('Inside refined range: ' + hist.histogram.histogram[2]); 

//addToMap(elev,{palette:'FFFFFF,403BCC',min:0,max:10000},"Elevation");
//addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");

// Filter results so we can draw them in separate layers.
var outRange = pointsBufMax.filter(ee.Filter.eq('max',0));
var inExpOutRef = pointsBufMax.filter(ee.Filter.eq('max',1));
var inRef = pointsBufMax.filter(ee.Filter.eq('max',2));

//addToMap(range, {opacity: 0.3, palette: 'FFFFFF,ff3366',min:0,max:1}, 'range');
//addToMap(habitat, {palette:'FFFFFF,036E52',min:0,max:1},"habitat");
addToMap(allrange.mask(range), {opacity: 0.8, palette:'FFFFFF,F5DFC1,73AAF5',min:0,max:2},"all range");

addToMap(outRange.draw('9C031D',3,0),{},"Outside range");
addToMap(inExpOutRef.draw('FACB0F',3,0),{},"Inside range outside refined range");
addToMap(inRef.draw('016B08',3,0),{},"Inside refined range");
addToMap(points,{},"Points");
