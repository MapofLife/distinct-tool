//refine_assess
//https://github.com/MapofLife/forest-tool/blob/master/playground/refine_assess.js
centerMap(-112,40, 4);

//SET VAR INPUT PARAMETERS
var forestCoverLow = 15*100; //greater than this (units need to be *100)
var forestCoverHigh = 75*100; //less than this (units need to be *100)
var elevationLow = 100; //greater than
var elevationHigh = 1000; //less than
var use_f = true;
var use_e = false;
var use_h = false;

var prefs = [0,1,2,3,4,5,6,7]; //use to select which habitat prefs.  this will be passed in by the user

//0:water, 1:evergreen needleleaf forest, 2: evergreen broadleaf forest,3:deciduous needleleaf forest,
//4:deciduous broadleaf forest, 5:mixed forest, 6:closed shrublands, 7: open shrublands, 8:woody savannas, 
//9:savannas, 10:grasslands, 11:permanent wetlands, 12:croplands, 13:urban and built-up, 
//14:cropland/natural vegetation mosiac, 15:snow and ice, 16: barren or sparsely vegetated

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

//make the tree cover layer
var forestHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"]);
if (use_f) {
  var forest = ee.Image('GME/images/04040405428907908306-09310201000644038383');
  forestHab = forestHab.where(forest.lt(forestCoverLow).or(forest.gt(forestCoverHigh)),0);
}
addToMap(forestHab,{},"forest habitat");
print(forestHab.getInfo());

//make the elevation layer
var elevHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"]);
if (use_e) {
  var elev = ee.Image('GME/images/04040405428907908306-08319720230328335274');
  elevHab = elevHab.where(elev.lt(elevationLow).or(elev.gt(elevationHigh)),0);
}
addToMap(elevHab,{},"elevation habitat");
print(elevHab.getInfo());

//make the landcover layer
var landcoverHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"]);
if (use_h) {
  var layerList = [];
  for(var i=0; i<prefs.length; i++) {
    layerList[i] = ee.Image('GME/images/' + modis_binary[prefs[i]]).mask(range.gte(0));
  }
  
  landcoverHab = ee.ImageCollection.fromImages(layerList)
                      .reduce(ee.Reducer.anyNonZero()) //OR the layers
                      .select(["b1_any"],["habitat"]);
}
addToMap(landcoverHab,{min:0,max:1},"land cover habitat");
print(landcoverHab.getInfo());

//AND all the layers together
var habitat = ee.Image(0).mask(0); // if the user turned off all habitat filters, they get nothing back
if (use_f || use_e || use_h) {

  habitat = ee.ImageCollection
              .fromImages([forestHab,elevHab,landcoverHab])
              .reduce(ee.Reducer.allNonZero()); //AND the layers
}
addToMap(habitat,{min:0,max:1},"combined habitat");


//we need a surface that has:
// 0 outside the original range, 
// 1 in the expert range but outside refined range, and 
// 2 in refined range
//need to use the method below so that we can ensure there are no masked out value, which messes up the reducer
var allrange = ee.Image(0)
        .where(range.eq(1), 1)
        .where(habitat.eq(1), 2);

//now we have the layer that has 1 for original range and 2 for refined range
//use reduce regions with the buffered points to find the maximum pixel
/*var pointsBufMax = allrange.reduceRegions(pointsBuf,ee.Reducer.max(),1000);

// Count the results with a histogram.
// Note, 0, 1 and 2 just happen to occur in the 0th, 1st and 2nd position.
var hist = pointsBufMax.reduceColumns(ee.Reducer.histogram(), ['max']).getInfo();

print('Outside range: ' + hist.histogram.histogram[0]);              
print('Inside range but outside refined range: ' + hist.histogram.histogram[1]); 
print('Inside refined range: ' + hist.histogram.histogram[2]); 

// Filter results so we can draw them in separate layers.
var outRange = pointsBufMax.filter(ee.Filter.eq('max',0));
var inExpOutRef = pointsBufMax.filter(ee.Filter.eq('max',1));
var inRef = pointsBufMax.filter(ee.Filter.eq('max',2));*/

//addToMap(elev,{palette:'FFFFFF,403BCC',min:0,max:10000},"Elevation");
//addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");
//addToMap(range, {opacity: 0.3, palette: 'FFFFFF,ff3366',min:0,max:1}, 'range');
//addToMap(habitat, {palette:'FFFFFF,036E52',min:0,max:1},"habitat");
//addToMap(allrange.mask(range), {opacity: 0.8, palette:'FFFFFF,F5DFC1,73AAF5',min:0,max:2},"all range");


//addToMap(habitat, {palette: "9BF2F2,52238C"}, "Habitat");
//addToMap(outRange.draw('9C031D',3,0),{},"Outside range");
//addToMap(inExpOutRef.draw('FACB0F',3,0),{},"Inside range outside refined range");
//addToMap(inRef.draw('016B08',3,0),{},"Inside refined range");
addToMap(points,{},"Points");
