//range_refine_test
//https://github.com/MapofLife/forest-tool/blob/master/playground/range_refine_test.js

//pull in a range map
//04040405428907908306-04550633376616161003 Abeomelomys_sevia range
//make up some habitat affinities
//make up an elevation

//1) % forest cover
var forest = ee.Image('GME/images/04040405428907908306-09310201000644038383');
forest = forest.divide(100);
addToMap(forest,{palette:'FCB360,065202',min:0,max:100},"% Forest Cover");

//2) MODIS Land Cover
var modis0 = ee.Image('GME/images/04040405428907908306-03680284325645907752');
addToMap(modis0,{palette:'FFFFFF,021E52',min:0,max:1},"MODIS 0");

var modis1 = ee.Image('GME/images/04040405428907908306-12923493437973401200');
addToMap(modis1,{palette:'FFFFFF,036E52',min:0,max:1},"MODIS 1");

//3) Elevation
//Look in python code for the id
