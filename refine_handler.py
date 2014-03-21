#!/usr/bin/python2.7
# -*- coding: utf-8 -*-

from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import urlfetch

import mol_assets
import os
import ee
import cache
import config
import webapp2
import httplib2
import urllib
import logging


from google.appengine.api import urlfetch

import json
from oauth2client.appengine import AppAssertionCredentials

EE_TILE_URL = 'https://earthengine.googleapis.com/map/%s/{Z}/{X}/{Y}?token=%s'

class RefineHandler(webapp2.RequestHandler):
    def render_template(self, f, template_args):
        path = os.path.join(os.path.dirname(__file__), "templates", f)
        self.response.out.write(template.render(path, template_args))

    def getRandomPoints(self,sciname):
        cdburl = 'https://mol.cartodb.com/api/v1/sql?q=%s'
        sql = "Select " \
            "round(CAST(ST_X(ST_Transform(the_geom_webmercator,4326)) as numeric),5) as lon, " \
            "round(CAST(ST_Y(ST_Transform(the_geom_webmercator,4326)) as numeric),5) as lat " \
            "FROM get_tile('gbif','points','%s','gbif_taxloc') " \
            "order by random() limit 1000"
        
        qstr = urllib.quote_plus((sql % (sciname)))
        url = cdburl % (qstr)
        #logging.info(url)
        points = urlfetch.fetch(url)
        
        return points.content
        
    def get(self):

        
        
        ee.Initialize(config.EE_CREDENTIALS, config.EE_URL)

        sciname = self.request.get('sciname', None)
        habitats = self.request.get('habitats', None)
        elevation = self.request.get('elevation', '-300,8000')
        mode = self.request.get('mode', 'area')
        ee_id = self.request.get('ee_id', None)
        minlng = self.request.get('minx', None)
        maxlng = self.request.get('maxx', None)
        minlat = self.request.get('miny', None)
        maxlat = self.request.get('maxy', None)
        minforest = self.request.get('minf', '0')
        maxforest = self.request.get('maxf', '100')
        use_f = (self.request.get('use_f') == 'true') #converts string to bool
        use_e = (self.request.get('use_e') == 'true')
        use_h = (self.request.get('use_h') == 'true')
        
        logging.info('use_f: %s, use_e: %s, use_h: %s' % (use_f,use_e,use_h))

        elev = ee.Image(mol_assets.elevation)
        #forest = ee.Image(mol_assets.forest)
        
        key = sciname+'|'+habitats+'|'+elevation+'|'+minforest+'|'+maxforest
        #response = cache.get(key,loads=True)
        #if response:
        #    self.response.headers["Content-Type"] = "application/json"
        #    self.response.out.write(response)
 
        minforest = int(minforest)*100
        maxforest = int(maxforest)*100
        
        region = ee.Feature(
            ee.Feature.Polygon([
                [float(minlng),float(minlat)],
                [float(minlng),float(maxlat)],
                [float(maxlng),float(maxlat)],
                [float(maxlng),float(minlat)],
                [float(minlng),float(minlat)]
            ])
        )
        geometry = region.geometry()

        #parse the CDB response
        minelev = int(elevation.split(',')[0])
        maxelev = int(elevation.split(',')[1])
        
        #handles case where habitat filter is on but user did not select habitats
        if habitats:
            habitat_list = map(int, habitats.split(","))
        else:
            habitat_list = []        
        
        # If any forest habitat is selected, select them all.
        hasForest=False
        for habitat in habitat_list:
            if habitat > 0 and habitat < 6:
                hasForest = True
        if hasForest:
            habitat_list = list(set([1,2,3,4,5]+habitat_list))
        #create the refined range
        range = ee.Image(ee_id)
        
        logging.info(habitat_list)
        logging.info(minforest)
        logging.info(maxforest)
        logging.info(minelev)
        logging.info(maxelev)
        
        #create the refined habitat. an empty range will be returned if all
        #    filters are turned off
        habitat = ee.Image(0).mask(0) 

        #make the tree cover layer
        forestHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"])
        if use_f:
          forest = ee.Image('GME/images/04040405428907908306-09310201000644038383');
          forestHab = forestHab.where(forest.lt(minforest).Or(forest.gt(maxforest)),0)
        
        #make the elevation layer
        elevHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"])
        if use_e:
          elevation = ee.Image('GME/images/04040405428907908306-08319720230328335274');
          elevHab = elevHab.where(elevation.lt(minelev).Or(elevation.gt(maxelev)),0)
        
        #make the landcover layer
        landcoverHab = ee.Image(1).mask(range.gte(0)).select(["constant"],["habitat"]);
        if use_h:
          if habitat_list:
              layerList = [];
              for pref in habitat_list:
                  layerList.append(ee.Image(mol_assets.modis_binary[pref]).mask(range.gte(0)))
              landcoverHab = ee.ImageCollection.fromImages(layerList).reduce(ee.Reducer.anyNonZero()).select(["b1_any"],["habitat"])
          else: #case where habitat types is on but no habitats selected
              landcoverHab = ee.Image(0).mask(range.gte(0)).select(["constant"],["habitat"]);

        #combine everything together
        if use_f or use_e or use_h:
          habitat = ee.ImageCollection.fromImages([forestHab,elevHab,landcoverHab]).reduce(ee.Reducer.allNonZero()) #AND the layers
        
        #if user turned off all toggles the empty range will be returned.
        
        pointJson = self.getRandomPoints(sciname)
        pointFc = self.getPointJSONToFC(pointJson)
        pointsBuf = self.getBufferedPoints(pointFc)
        
        
        if pointsBuf:
            allrange = ee.Image(0).where(
                range.eq(1),1).where(habitat.eq(1),2)
            
            pointsBufMax = allrange.reduceRegions(
                pointsBuf,
                ee.Reducer.max(),
                1000) 
            
            #points_buffered_map = pointsBufMax.getMapId(
            #   {
            #        'palette':'9C031D,FACB0F,016B08',
            #        'min':0,
            #        'max':2
            #    }
            #)
            
            hist =  pointsBufMax.reduceColumns(
                ee.Reducer.histogram(),
                ['max']).getInfo()
            
            #pointImg = ee.Image()
            
            #pointImg = pointImage.paint(out_pts,"9C031D",0)
            #pointImg = pointImage.paint(range_pts,"FACB0F",0)
            #pointImg = pointImage.paint(habitat_pts,"016B08",0)
            
            #out_pts_map = ee.Image(out_pts.('9C031D',3)
            #range_pts_map = range_pts.draw('FACB0F',3).add(out_pts_map)
            #habitat_pts_map = habitat_pts.draw('016B08',3).add(range_pts_map).getMapId()
            
            
            points_buffered_map =  pointsBuf.getMapId()
            points_map = pointFc.getMapId()
            
            if len(hist["histogram"]["histogram"]) >= 3:
                habitat_pts_ct = hist["histogram"]["histogram"][2]
            else:
                habitat_pts_ct = None
                
            if len(hist["histogram"]["histogram"]) >= 2:
                range_pts_ct = hist["histogram"]["histogram"][1]
            else:
                range_pts_ct = None
                
            if len(hist["histogram"]["histogram"]) >= 1:
                out_pts_ct = hist["histogram"]["histogram"][0]
            else:
                out_pts_ct = None
                
            #range_pts_tileurl = EE_TILE_URL % (
            #         range_pts_map['mapid'], range_pts_map['token'])
            #out_pts_tileurl = EE_TILE_URL % (
            #         out_pts_map['mapid'], out_pts_map['token'])
            #habitat_pts_tileurl = EE_TILE_URL % (
            #         habitat_pts_map['mapid'], habitat_pts_map['token'])
            
            points_buffered_tileurl = EE_TILE_URL % (
                     points_buffered_map['mapid'], points_buffered_map['token'])
            points_tileurl = EE_TILE_URL % (
                     points_map['mapid'], points_map['token'])
            
        else:
            habitat_pts_ct = None
            range_pts_ct = None   
            out_pts_ct = None
            out_pts_tileurl = None
            range_pts_tileurl = None
            habitat_pts_tileurl = None
            points_tileurl = None
            points_buffered_tileurl = None
        
        area = ee.call("Image.pixelArea")
        sum_reducer = ee.call("Reducer.sum")
        
        habitat_area = area.mask(habitat.gt(0)).reduceRegion(
            ee.Reducer.sum(), 
            geometry, 
            scale=1000,
            maxPixels=10000000000)
        
        range_area = area.mask(range.gt(0)).reduceRegion(
            ee.Reducer.sum(), 
            geometry, 
            scale=1000,
            maxPixels=10000000000)
    
        properties = {
            'habitat_area': habitat_area,
            'range_area' : range_area
        }

        output = region.set(properties)

        data = ee.data.getValue({"json": output.serialize()})
        data = data["properties"]
        logging.info(json.dumps(data))
        
        habitat_area = round((data["habitat_area"]["area"]) / 1000000)
        range_area = round((data["range_area"]["area"]) / 1000000)
        try:
            habitat = habitat.mask(habitat.gt(0))
            habitat_map = habitat.getMapId({'palette': '85AD5A'})
            
            habitat_tileurl = EE_TILE_URL % (
                 habitat_map['mapid'], habitat_map['token'])
        except:
            habitat_tileurl = None
         
        #metrics
        logging.info(habitat_area)
        logging.info(range_area)
        logging.info(habitat_pts_ct)
        logging.info(range_pts_ct)
        
        if habitat_area <> None and range_area <> None and habitat_pts_ct <> None and range_pts_ct <> None:
            
            range_change = round(100*(habitat_area - range_area) / range_area) # % change in range
            expert_precision = habitat_area/range_area
            expert_sensitivity = 1
            expert_f = round(100*self.getFScore(expert_precision,expert_sensitivity))
            
            refined_precision = 1
            refined_sensitivity = habitat_pts_ct / (range_pts_ct + habitat_pts_ct)
            refined_f = round(100*self.getFScore(refined_precision,refined_sensitivity))
            
            precision_change = round(100*(refined_precision - expert_precision))
            sensitivity_change = round(100*(refined_sensitivity - expert_sensitivity))
            f_change = refined_f - expert_f
            num_points = range_pts_ct + habitat_pts_ct
            expert_f = round(expert_f,2)
            
            logging.info('expert_f: %f' % (expert_f,))
            logging.info('refined_f: %f' % (refined_f,))
            
        else:
            expert_precision = None
            expert_sensitivity = None
            expert_f = None
            refined_precision = None
            refined_sensitivity = None
            refined_f = None
            precision_change = None
            sensitivity_change = None
            f_change = None
            num_points = None
        
        #assemble the response object

        
        response = {
            'maps' : [ #map, type, label
                {'tile_url': habitat_tileurl, 'opacity' : 0.8},
                #range_pts_tileurl,
                #habitat_pts_tileurl,
                #out_pts_tileurl,
                {'tile_url':points_buffered_tileurl, 'opacity' : 0.2},
                {'tile_url':points_tileurl, 'opacity' : 0.6}
            ],
            'metrics' : [ #label, value, units
                {'name':'Expert range size', 'value':range_area, 'units':'km²'},
                {'name':'Refined range size', 'value':habitat_area,'units':'km²'},
                {'name':'Change in range size', 'value':range_change, 'units': '%'},
                {'name':'Refined map performance', 'value': refined_f, 'units': '%'},
                {'name':'Change in map performance', 'value': f_change, 'units': '%'},
                {'name':'Change in sensitivity', 'value': sensitivity_change, 'units':'%'},
                {'name':'Validation points in refined range', 'value': habitat_pts_ct},
                {'name':'Total available validation points', 'value': num_points}
            ],
            'scientificname' : sciname
        }

        #cache.add(key,json.dumps(response,ensure_ascii=False),dumps=True)
        
        self.response.headers["Content-Type"] = "application/json"
        self.response.out.write(json.dumps(response))

    def getFScore(self,precision,sensitivity):
        return 2 * (precision * sensitivity) / (precision + sensitivity)

    def getPointJSONToFC(self,pointjson):
        pjson = json.loads(pointjson)
            
        logging.info(json.dumps(pjson))
            
        if pjson["total_rows"] == 0:
            return None
        else:
            #Create an array of Points
            pts = []
            for row in pjson["rows"]:
                pts.append(
                   ee.Feature(
                      ee.Feature.Point(
                         row["lon"],row["lat"]),
                         {'val':0, 'u' : 0 }))
            
            #Create a FeatureCollection from that array 
            pts_fc = ee.FeatureCollection(pts)
            return pts_fc
        
    def getBufferedPoints(self,pointFc):
        try:
            return pointFc.map(lambda f: f.buffer(10000))
        except:
            logging.info(pointFc)
            return None
                
application = webapp2.WSGIApplication(
    [ ('/refine', RefineHandler)], debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
