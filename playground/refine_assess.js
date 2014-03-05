//refine_assess
//https://github.com/MapofLife/forest-tool/blob/master/playground/refine_assess.js
centerMap(-112,40, 4);

//SET VAR INPUT PARAMETERS
var forestCoverLow = 25; //greater than this
var forestCoverHigh = 75; //less than this
var elevationLow = 1800; //greater than
var elevationHigh = 20000; //less than

var prefs = [0,1,2,3,4,5,6,7,8,9]; //use to select which habitat prefs.  this will be passed in by the user

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
var forest = ee.Image('GME/images/04040405428907908306-09310201000644038383')
                .divide(100); //need to divide by 100 then we get two digit %
var elev = ee.Image('GME/images/04040405428907908306-08319720230328335274');
var habitat = ee.Image(0); //initialize habitat image
var modisForest = ee.Image(0); //initialize forest image


var pref,layer;
var useForest=false;

//we need to treat all forest layers (1-5) as a single layer, and this layer works differently in conjunction 
//with the other landcover layers.  see below for rules.
for(var i=0; i<prefs.length; i++) {
  pref = prefs[i];
  layer = ee.Image('GME/images/' + modis_binary[pref]).mask(range);
  
  if(pref >= 1 && pref <= 5 ) {
    modisForest = modisForest.add(layer);
    useForest = true;
  } else {
    habitat = habitat.add(layer);
  }
}

///// habitat refinement rules:
//for any forest layers, we intersect with the % forest cutoffs sent in by user
//we ignore % forest cutoffs for any other landcover types
//if the resulting layer has pixels that are not habitat, but it is in the % forest cutoffs, we consider this as habitat
//finally, anything outside of the elevation range we consider not habitat
//note that the user can only select % forest cutoffs if they have "forest" as a preference

if(useForest) {
  modisForest = modisForest
    .where(forest.lt(forestCoverLow).or(forest.gt(forestCoverHigh)),0); 
  //add the forest pixels to the habitat layer
  //also add any pixels that are currently not habitat but have forest cover w/in user supplied cutoff
  habitat = habitat.add(modisForest)
              .where(habitat.eq(0).and(forest.gte(forestCoverLow).and(forest.lte(forestCoverHigh))),1);
}

habitat = habitat.gte(1);//since we are just adding all the habitat layers, we might end up with pixels > 1
// don't know why but elevation layer is giving me errors right now
//            .where(elev.lt(elevationLow).or(elev.gt(elevationHigh)),0); //remove all pixels outside the bound of elevation

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
var pointsBufMax = allrange.reduceRegions(pointsBuf,ee.Reducer.max(),1000);

// Count the results with a histogram.
// Note, 0, 1 and 2 just happen to occur in the 0th, 1st and 2nd position.
var hist = pointsBufMax.reduceColumns(ee.Reducer.histogram(), ['max']).getInfo();

print('Outside range: ' + hist.histogram.histogram[0]);              
print('Inside range but outside refined range: ' + hist.histogram.histogram[1]); 
print('Inside refined range: ' + hist.histogram.histogram[2]); 

// Filter results so we can draw them in separate layers.
var outRange = pointsBufMax.filter(ee.Filter.eq('max',0));
var inExpOutRef = pointsBufMax.filter(ee.Filter.eq('max',1));
var inRef = pointsBufMax.filter(ee.Filter.eq('max',2));

//addToMap(elev,{palette:'FFFFFF,403BCC',min:0,max:10000},"Elevation");
//addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");
//addToMap(range, {opacity: 0.3, palette: 'FFFFFF,ff3366',min:0,max:1}, 'range');
//addToMap(habitat, {palette:'FFFFFF,036E52',min:0,max:1},"habitat");
addToMap(allrange.mask(range), {opacity: 0.8, palette:'FFFFFF,F5DFC1,73AAF5',min:0,max:2},"all range");

addToMap(outRange.draw('9C031D',3,0),{},"Outside range");
addToMap(inExpOutRef.draw('FACB0F',3,0),{},"Inside range outside refined range");
addToMap(inRef.draw('016B08',3,0),{},"Inside refined range");
addToMap(points,{},"Points");
