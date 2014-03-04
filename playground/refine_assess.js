//range_refine_test
centerMap(-112,47, 8);

//SET VAR INPUT PARAMETERS
var forestCoverLow = 25; //greater than this
var forestCoverHigh = 50; //less than this
var elevationLow = 1800; //greater than
var elevationHigh = 20000; //less than

var prefs = [0,1,3]; //use to select which habitat prefs.  this will be passed in by the user

//maps engine id's for the assests.  there should be a total of 12, only using 4 right now.
var modis_binary = {
  0:'04040405428907908306-03680284325645907752',
  1:'04040405428907908306-12923493437973401200',
  2:'04040405428907908306-16898429718931540991',
  3:'04040405428907908306-16395992718068236206'
};

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
            .where(forest.lt(forestCoverLow).or(forest.gt(forestCoverHigh)),0) //remove all pixels outside the bounds of forest cover
            .where(elev.lt(elevationLow).or(elev.gt(elevationHigh)),0); //remove all pixels outside the bound of elevation

addToMap(elev,{palette:'FFFFFF,403BCC',min:0,max:10000},"Elevation");
addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");
addToMap(range, {opacity: 0.3, palette: 'FFFFFF,ff3366',min:0,max:1}, 'range');
addToMap(habitat, {palette:'FFFFFF,036E52',min:0,max:1},"habitat");
