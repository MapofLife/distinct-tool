var scientificname = getURLParameter("name"),
    latest = 0, 
    commonnames = '',
    modis_maptypes = {},
    mod_params,
    chartData = [],
    speciesPrefs,
    host = '', //(window.location.hostname != 'localhost') ?
        //'http://d152fom84hgyre.cloudfront.net/' : '',
    map_options = {
        zoom: 2,
        minZoom: 2,
        scaleControl: true,
        center: new google.maps.LatLng(0,0),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        panControl: false,
        styles: [
          {
            "featureType": "landscape",
            "stylers": [
              { "color": "#f4f4f4" }
            ]
          },{
            "featureType": "water",
            "stylers": [
              { "visibility": "simplified" }
            ]
          },{
              "featureType": "water",
            "elementType": "labels",
            "stylers": [
              { "visibility": "off" }
            ]
          },{
            "featureType": "water",
            "stylers": [
              { "color": "#808080" }
            ]
          },{
            "featureType": "administrative",
            "stylers": [
              { "visibility": "off" }
            ]
          },{
            "featureType": "administrative.country",
            "elementType": "labels",
            "stylers": [
              { "visibility": "off" }
            ]
          },{
            "featureType": "road",
            "stylers": [
              { "visibility": "off" }
            ]
          },{
            "featureType": "poi",
            "stylers": [
              { "visibility": "off" }
            ]
          }
        ]               
    },
    map = new google.maps.Map($('.map')[0],map_options);
    
                    
google.setOnLoadCallback(init);

$.ui.autocomplete.prototype._renderItem = function (ul, item) {

    item.label = item.label.replace(
        new RegExp("(?![^&;]+;)(?!<[^<>]*)(" +
           $.ui.autocomplete.escapeRegex(this.term) +
           ")(?![^<>]*>)(?![^&;]+;)", "gi"),
        "<strong>$1</strong>"
    );
    return $("<li></li>")
        .data("item.autocomplete", item)
        .append("<a>" + item.label + "</a>")
        .appendTo(ul);
};

function getImage() {
    $.getJSON(
        'https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' +
            scientificname +'&callback=?',
        function(response) {
            var src = response.responseData.results[0].url;
            $('.image').empty();
            $('.image').append($('<img class="specimg" src="'+src+'">'));
            
        },
        'jsonp'
    );
}

function getURLParameter(name) {
    return decodeURI((RegExp(name + '=' + '(.+?)(&|$)')
    .exec(location.search)||[,null])[1]);
}
function getRandom() {
    $.getJSON(
        'http://mol.cartodb.com/api/v1/sql',
        {
            q: 'SELECT binomial FROM modis_prefs_join m join ee_assets ee on m.binomial = ee.scientificname  limit 1 offset 33834*RANDOM()'
        },
        function (result) {
            //$('.search').val(getEE_ID(result.rows[0].binomial));
            getEE_ID(result.rows[0].binomial);
        }
    );
}
function init() {
        $('.search').keypress(function(e) {
            if(e.which == 13) {
                getEE_ID($(this).val());
                setTimeout(2000,"$('.search').autocomplete('close');");
            }
        });
        
        //Set up autocomplete
        $('.search').autocomplete({
            minLength: 3,
            source: function(request, response) {
                $.getJSON(
                    'http://mol.cartodb.com/api/v1/sql?q=' +
                    'SELECT n, v FROM ac_mar_8_2013 ac ' +
                    ' LEFT JOIN elevandhabitat e ' +
                    'ON ac.n = e.scientific ' + 
                    ' LEFT JOIN modis_prefs_join m ' +
                    ' ON ac.n = m.binomial ' + 
                    "where (m.modisprefs is not null OR e.habitatprefs is not null) AND (n~*'\\m{TERM}' OR v~*'\\m{TERM}')"
                        .replace(/{TERM}/g, request.term),
                    function (json) {
                        var names = [],scinames=[];
                        $.each (
                            json.rows,
                            function(row) {
                                var sci, eng;
                                if(json.rows[row].n != undefined){
                                    sci = $.trim(json.rows[row].n);
                                    eng = (json.rows[row].v == null ||
                                        json.rows[row].v == '') ?
                                            '' :
                                            ', ' +
                                                json.rows[row].v.replace(
                                                    /'S/g, "'s"
                                                
                                            );
                                    names.push({
                                        label:'<div class="sci">'+sci+'</div>' +
                                              '<div class="eng">'+eng +'</div>',
                                        value:sci
                                    });
                                    scinames.push(sci);
                               }
                           }
                        );
                        response(names);
                        
                     },
                     'json'
                );
            },
       
            select: function(event, ui) {
                getEE_ID(ui.item.value);
            },
            close: function(event,ui) {

            },
            search: function(event, ui) {
                //getEE_ID(ui.item.value);
                
            },
            open: function(event, ui) {
                
                
            }
      });
      
      $('.habitats [class*=class_]').click(
          function() {
              if($(this).hasClass('selected')) {
                  $(this).removeClass('selected');
              } else {
                  $(this).addClass('selected');
              }
              $('.rerun').show();
          }
      );

      
      $('.elev .range').slider(
          {
              range: true,
              min: -500,
              max: 8000,
              values: [ -500, 8000 ],
              step: 100,
              rangeDrag: true, 
              slide: function( event, ui ) {
                $('.elev .values').html(
                    'Elevation range: ' + 
                    ui.values[ 0 ]+ 
                    'm to ' +
                    ui.values[ 1 ] + 'm');
                $('.rerun').show();
              }
        }
      );
      $('.forest .range').slider(
          {
              range: true,
              min: 0,
              max: 100,
              step: 5,
              values: [0, 100 ],
              rangeDrag: true, 
              slide: function( event, ui ) {
                $('.forest .values').html(
                    'Forest coverage: ' + 
                    ui.values[ 0 ]+ 
                    '% to ' +
                    ui.values[ 1 ] + '%');
                $('.rerun').show();
              }
        }
      );
      
      $('.rerun').click(
          function() {
              speciesPrefs.rows[0].modis_habitats = _.map(
                  $('.habitats [class*=class_] .selected'),
                  function(elem,index) {
                    return $(elem).attr("class").replace("class_","");
                  }
              ).join(',');
              speciesPrefs.rows[0].mine = $('.elev .range').slider('values',0);
              speciesPrefs.rows[0].maxe = $('.elev .range').slider('values',1);
              callBackend(speciesPrefs);     
          }
      );
      
      $('.assess').click(doAssessment);

      $('.mode').change(
          function() {
              if(chartData.area.length > 0) {
                  chartHandler(chartData);
              }
          }
      );
    if(getURLParameter("name")!='null') {
        getEE_ID(getURLParameter("name"));
    } else {
        $('.working').hide();
        clearCharts();
    }
}
function doAssessment () {
    mod_params["mode"]= "assess";
    mod_params["sciname"]= scientificname;
    mod_params["call_ver"]= latest;
       
        $.getJSON(
            '/api/assess',
            mod_params,
            function(response) {
                alert(response.toString());
            }
        );
}
function clearCharts() {
    
}
function showLoaders() {
   // $('.map').html('<img height=25 width=25 src="/images/loading.gif">');
    
}
function getEE_ID(name) {
    var sql = '' + 
         'SELECT DISTINCT ' +
                'l.scientificname as scientificname, ' +
                'CASE WHEN e.habitatprefs is null THEN ' +
                    'm.modisprefs '+
                'ELSE ' +
                  ' e.habitatprefs end as modis_habitats, ' +
                "CASE WHEN e.finalmin is null OR e.finalmin = 'DD' then '-1000' else e.finalmin end as mine, " +
                "CASE WHEN e.finalmax is null OR e.finalmax = 'DD' then '10000' else e.finalmax end as maxe, " +
                'ee.ee_id as ee_id, ' +
                'CONCAT(n.v,\'\') as names, ' +
                'ST_xmin(l.extent_4326) as minx, ' +
                'ST_ymin(l.extent_4326) as miny, ' +
                'ST_xmax(l.extent_4326) as maxx, ' +
                'ST_ymax(l.extent_4326) as maxy, ' +
                "(SELECT ROUND(SUM(ST_Area(geography(ST_Transform(the_geom_webmercator,4326))))/1000000) as area from get_tile(TEXT('iucn'),TEXT('range'),l.scientificname,null)) as area," +
                'CASE when eol.good then eolthumbnailurl else null end as eolthumbnailurl, ' +
                'CASE when eol.good then eolmediaurl else null end as eolmediaurl, ' +
                'initcap(t.class) as _class, initcap(family) as family, initcap(_order) as _order ' +
            'FROM layer_metadata_mar_8_2013 l ' +
            ' LEFT JOIN taxonomy t ON ' +
            'l.scientificname = t.scientificname ' +
            ' LEFT JOIN ee_assets ee ON ' +
            ' l.scientificname = ee.scientificname ' +
            'LEFT JOIN ac_mar_8_2013 n ON ' +
                'ee.scientificname = n.n ' +
            'LEFT JOIN elevandhabitat e ON ' +
                'ee.scientificname = e.scientific ' +
            'LEFT JOIN modis_prefs_join m' +
            ' ON ee.scientificname = m.binomial ' +
            'LEFT JOIN eol ON ' +
            ' ee.scientificname = eol.scientificname ' +
            "where (m.modisprefs is not null OR e.habitatprefs is not null) AND (n.n~*'\\m{TERM}' OR n.v~*'\\m{TERM}') " +
                 " and ee.dataset_id ILIKE'%iucn%' " +
                 " and ee.ee_id is not null " + 
                 " and l.type='range' and l.provider='iucn'" +
            ' LIMIT 1',
         term = name,
         source = (getURLParameter("source") != "null") ? 
            getURLParameter("source") : 'iucn',
         params = {q : sql.replace(/{TERM}/g,term).replace(/{SOURCE}/g,source)};
         
    clearCharts();
    showLoaders();
    chartData = [];
    
    $.getJSON(
        'http://mol.cartodb.com/api/v2/sql', 
        params, 
        callBackend
        ).error(
            function() {
                $('.working').hide();
                $('.visualization').html(
                    "There are no range maps or " + 
                    "habitat preference data for this species.");
            }
        );    
}
function callBackend(response) {
    var bounds, habitats;
    latest++; 
    $('.rerun').hide();
    speciesPrefs = response;
    if (response.total_rows == 0) {
        $('.working').hide();
        $('.image').empty();
        $('.visualization').html('There are no range maps or habitat preference data for this species.');
        return;
    } else {
        $('.msg').html('');
    }
    

    $('.info').hide();
    bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(response.rows[0].miny, response.rows[0].minx),
        new google.maps.LatLng(response.rows[0].maxy, response.rows[0].maxx)
    );
            habitats = response.rows[0].modis_habitats.split(','),
            elev = [response.rows[0].mine, response.rows[0].maxe],
            ee_id = response.rows[0].ee_id;
            
        mod_params = {
            habitats : response.rows[0].modis_habitats,
            elevation : elev.join(','),
            ee_id : ee_id,
            mod_ver: 5.1, //$('.mod_ver').val(),
            minx: response.rows[0].minx,
            miny: response.rows[0].miny,
            maxx: response.rows[0].maxx,
            maxy: response.rows[0].maxy,
            get_area: true,
            call_ver: latest
        };
    scientificname = response.rows[0].scientificname;
    commonnames = ' (' + response.rows[0].names + ')';
    if(response.rows[0].eolthumbnailurl!=null) {
        $('.image').empty();
        $('.image').append($('<img class="specimg" src="'+response.rows[0].eolmediaurl+'">'));
        $('.area').html('Expert range map area: ' + response.rows[0].area + ' km<sup>2</sup>');
        
        
    } else {
         getImage();
    }
    
    $('.sciname').html(response.rows[0].scientificname);
    $('.common').html(response.rows[0].names.replace(/,.*/,''));
    if(response.rows[0]._class!=null) {        
        $('._class').html('Class: ' + response.rows[0]._class);
    } else {
        
    }
    
    $('.family').html('Family: ' + response.rows[0].family);
    $('._order').html('Order: ' + response.rows[0]._order);

    if(elev[0] != '-1000' && elev[1] != '10000') {
        $('.elev .range').slider("values",[Math.round(parseFloat(elev[0])),Math.round(parseFloat(elev[1]))]);
        $('.elev .values').html('Elevation range: ' + elev[0] + 'm to ' + elev[1] + 'm');
    } else {
        $('.elev .range').slider("values",[-500,8000]);
        $('.elev .values').html('All elevations');
        
    }
    
    $('.habitats [class*=class_]').removeClass('selected');
   
    $.each(
        habitats,
        function(i) {
            if(i>0&&i<6) {
                i=1;
            }
            $('.habitats .class_'+habitats[i]).addClass('selected');
        }
    );
    $('.info').show('fade');
    
    mod_params.get_area = 'true';
    
    $.getJSON(
        host+'api/change?callback=?', 
        mod_params, 
        function(response) {
            metricsHandler(response);
        },
        'jsonp'
    ).error(
        function() {
            $.getJSON(
                host+'api/change?/callback=?',
                mod_params,
                function(response) {
                    chartHandler(response);
                },
        'jsonp'
            );
        }
    );
    
    mod_params.get_area = 'false';
    $.getJSON(
        host+'api/change?callback=?', 
        mod_params, 
        function(response) {
            map.fitBounds(bounds);
            mapHandler(response);
        },
        'jsonp'
    ).error(
        function() {
            $.getJSON(
                host+'api/change?callback=?', 
                mod_params, 
                function(response) {
                    mapHandler(response);
                },
        'jsonp'
            );
        }
    );
}

function metricsHandler(response) {

}

function mapHandler(modis_layers) {

    var cdb_url = "http://d3dvrpov25vfw0.cloudfront.net/" +
            "tiles/change_tool/{Z}/{X}/{Y}.png?sql=" +
            "SELECT * FROM get_tile('iucn','range','{name}',null)"
        .replace('{name}',scientificname),
        cdb_maptype  = new google.maps.ImageMapType({
                getTileUrl: function(coord, zoom) {
                    return cdb_url
                        .replace(/{X}/g, coord.x)
                        .replace(/{Y}/g, coord.y)
                        .replace(/{Z}/g, zoom);
                },
                tileSize: new google.maps.Size(256, 256)
            });
        
    $.each(
        modis_layers,
        function(year) {
            modis_maptypes[year] = new google.maps.ImageMapType({
                getTileUrl: function(coord, zoom) {
                    return modis_layers[year]
                        .replace(/{X}/g, coord.x)
                        .replace(/{Y}/g, coord.y)
                        .replace(/{Z}/g, zoom);
                },
                tileSize: new google.maps.Size(256, 256)
            });
        }
    );
    
    map.overlayMapTypes.setAt(0,modis_maptypes['modis_2001']);
    map.overlayMapTypes.setAt(1,cdb_maptype);
}
