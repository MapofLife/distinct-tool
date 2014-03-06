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
            "ST_X(ST_Transform(the_geom_webmercator,4326)) as lon, " \
            "ST_Y(ST_Transform(the_geom_webmercator,4326)) as lat " \
            "FROM get_tile('gbif','points','%s','gbif_taxloc') " \
            "order by random() limit 1000"
        
        qstr = urllib.quote_plus((sql % (sciname)))
        url = cdburl % (qstr)
        logging.info(url)
        points = urlfetch.fetch(url)
        return points.content
        
    def get(self):

        
        
        ee.Initialize(config.EE_CREDENTIALS, config.EE_URL)

        sciname = self.request.get('sciname', None)
        habitats = self.request.get('habitats', None)
        elevation = self.request.get('elevation', '-300,8000')
        year = self.request.get('year', None)
        mode = self.request.get('mode', 'area')
        ee_id = self.request.get('ee_id', None)
        minlng = self.request.get('minx', None)
        maxlng = self.request.get('maxx', None)
        minlat = self.request.get('miny', None)
        maxlat = self.request.get('maxy', None)
        minforest = self.request.get('minf', '0')
        maxforest = self.request.get('maxf', '100')
                
        elev = ee.Image(mol_assets.elevation)
        forest = ee.Image(mol_assets.forest)
        
        key = sciname+'|'+habitats+'|'+elevation+'|'+minforest+'|'+maxforest
        response = cache.get(key,loads=True)
        if response:
            self.response.headers["Content-Type"] = "application/json"
            self.response.out.write(response)
 
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
        habitat_list = map(int, habitats.split(","))
        
        hasForest=False
        for habitat in habitat_list:
            if habitat > 0 and habitat < 6:
                hasForest = True
        if hasForest:
            habitateList = list(set([1,2,3,4,5]+habitat_list))
        #create the refined range
        range = ee.Image(ee_id)
        
        habitat = ee.Image(0)

        #create the refined habitat
        habitat = habitat.mask(range)

        for pref in habitat_list:
            modis_habitat = ee.Image(mol_assets.modis_binary[pref])
            if pref > 0 and pref < 6:
                habitat = habitat.where(
                    modis_habitat.gt(0)
                        .And(forest.gt(minforest)
                           .And(forest.lt(maxforest)))
                        .And(elev.gt(minelev))
                        .And(elev.lt(maxelev)),
                        1
                    )
            else:
               habitat = habitat.where(
                    modis_habitat
                        .gt(0)
                        .Or(forest.gt(minforest)
                            .And(forest.lt(maxforest)))
                        .And(elev.gt(minelev))
                        .And(elev.lt(maxelev)),
                        1
                    )
                
        habitat = habitat.mask(habitat)
        
        pointsBuf = self.getBufferedPoints(sciname)
        
        if pointsBuf:
            allrange = ee.Image(0).where(range.gt(0),1).where(habitat.eq(1),2)
            
            pointsBufMax = allrange.reduceRegions(
                pointsBuf,
                ee.Reducer.max(),
                1000) 
            
            hist =  pointsBufMax.reduceColumns(
                ee.Reducer.histogram(),
                ['max']).getInfo()
                
            logging.info(json.dumps(hist))
            
            out_pts = pointsBufMax.filter(ee.Filter.eq('max',0))
            range_pts = pointsBufMax.filter(ee.Filter.eq('max',1))
            habitat_pts = pointsBufMax.filter(ee.Filter.eq('max',2))
            
            #out_pts_map = out_pts.getMapId({'palette':'9C031D'})
            #range_pts_map = range_pts.getMapId({'palette':'FACB0F'})
            #habitat_pts_map = habitat_pts.getMapId({'palette':'016B08'})
            
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
            
        else:
            habitat_pts_ct = None
            range_pts_ct = None   
            out_pts_ct = None
            out_pts_tileurl = None
            range_pts_tileurl = None
            habitat_pts_tileurl = None
        
        area = ee.call("Image.pixelArea")
        sum_reducer = ee.call("Reducer.sum")
        
        habitat_area = area.mask(habitat).reduceRegion(
            ee.Reducer.sum(), 
            geometry, 
            scale=1000,
            maxPixels=10000000000)
        
        range_area = area.mask(range).reduceRegion(
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
        
        habitat = habitat.mask(habitat)
        habitat_map = habitat.getMapId({'palette': '85AD5A'})
        
        habitat_tileurl = EE_TILE_URL % (
             habitat_map['mapid'], habitat_map['token'])
         
        #assemble the response object
        response = {
            'maps' : [
                habitat_tileurl
                #range_pts_tileurl,
                #habitat_pts_tileurl,
                #out_pts_tileurl
            ],
            'area' : {
                'range' : range_area,
                'habitat' : habitat_area
            },
            'points' : {
                'out' : out_pts_ct,
                'range' : range_pts_ct,
                'habitat' : habitat_pts_ct
            },
            'scientificname' : sciname
        }
        
        cache.add(key,json.dumps(response,ensure_ascii=False),dumps=True)
        
        self.response.headers["Content-Type"] = "application/json"
        self.response.out.write(json.dumps(response))


    def getBufferedPoints(self,sciname):
        pointjson = self.getRandomPoints(sciname)
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
                         {'val':0 }))
            
            #Create a FeatureCollection from that array 
            pts_fc = ee.FeatureCollection(pts)
            pointsBuf = pts_fc.map(lambda f: f.buffer(10000))
            return pointsBuf
                
application = webapp2.WSGIApplication(
    [ ('/refine', RefineHandler)], debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()