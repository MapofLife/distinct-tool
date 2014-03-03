//range_refine_test
//https://github.com/MapofLife/forest-tool/blob/master/playground/range_refine_test.js
//sample using Abeomelomys_sevia
centerMap(144.86572,-5.92204, 8);

//MAKE RANGE
//04040405428907908306-04550633376616161003 Abeomelomys_sevia range
var range =  ee.Image('GME/images/04040405428907908306-04550633376616161003');
addToMap(range, {opacity: 0.3, palette: 'ff3366'}, 'range');

//SET VAR INPUT PARAMETERS
var forestCover = 75; //greater than
var MODIS0      = 1; 
var MODIS1      = 1; 
var Elevation   = 2000; //greater than

//CREATE 4 VARS
//1) % forest cover
var forest = ee.Image('GME/images/04040405428907908306-09310201000644038383');
forest = forest.divide(100);
//addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");
var forFilter = range.where(forest.lt(forestCover),0);
var out = forFilter.where(forest.gte(forestCover),1);
//addToMap(forFilter,{ palette: 'cccccc,ff6666', max:1, min:0}, 'forest');

//2) MODIS Land Cover (2 vars)
var modis0 = ee.Image('GME/images/04040405428907908306-03680284325645907752');
//addToMap(modis0,{palette:'FFFFFF,021E52',min:0,max:1},"MODIS 0");
var mod0Filter = range.where(modis0.eq(MODIS0),1);
//addToMap(mod0Filter,{ palette: 'cccccc,ff6666', max:1, min:0}, 'modis0');

var modis1 = ee.Image('GME/images/04040405428907908306-12923493437973401200');
//addToMap(modis1,{palette:'FFFFFF,036E52',min:0,max:1},"MODIS 1");
var mod1Filter = range.where(modis1.eq(MODIS1),1);
//addToMap(mod1Filter,{ palette: 'cccccc,ff6666', max:1, min:0}, 'modis1');

//3) Elevation
//Look in python code for the id
var elevationlayer = ee.Image('GME/images/04040405428907908306-08319720230328335274');

var ElvRange = elevationlayer.mask(range);
//addToMap(ElvRange, "elvRange");
var ElvFilter = range.where(elevationlayer.lt(Elevation),0)
var out = ElvFilter.where(elevationlayer.gte(Elevation),1)
//addToMap(ElvFilter,{ palette: 'cccccc,ff6666', max:1, min:0}, 'Elevation');


//COMPILE INTO ONE SURFACE with 4 bands
var two   = forFilter.add(mod0Filter);
var three = two.add(mod1Filter);
var four  = three.add(ElvFilter);
addToMap(four, {palette: '036E52, cccccc, 33ffff, 33ff66', max:4, min: 0}, 'refined surface');
//I am confused about the line below,its outputtig everything above 1 and making the rest 0 I think
var four = four.where(four.gte(4),1)
var four = four.where(four.lte(1),0)
addToMap(four, {palette: '330099,33ffff', max:1, min:0}, 'refined'); 

//MAKE THE ranges surface
//we need to set up the data so that range has 1, refined has 2
range = range.subtract(range); //set up range so that its 0
range = range.add(1); //now add one 
//refined is masked so we can't just add.  instead set to 2 where its currently 1
var refined = four.where(four.gte(1),2); 

var allrange = ee.ImageCollection.fromImages([range,refined])
                  .reduce(ee.Reducer.max())
                  .mask(ee.Image(1));

addToMap(allrange);
