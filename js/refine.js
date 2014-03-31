var scientificname = getURLParameter("name"),
    latest = 0, 
    commonnames = '',
    modis_maptypes = {},
    mod_params,
    chartData = [],
    speciesPrefs,
    host = '', //(window.location.hostname != 'localhost') ?
        //'http://d152fom84hgyre.cloudfront.net/' : '',
    map = new google.maps.Map($('.map')[0],defaults.map_options);
    
                    
google.setOnLoadCallback(init);

function getImage(src) {

    if (src == null && scientificname != undefined && scientificname != null) {
        $.getJSON(
            'https://ajax.googleapis.com/ajax/services/search/images?' +
            'v=1.0&q={0}&callback=?'.format(scientificname),
            function(response) {
                try {
                    console.log(response)
                    loadImage(response.responseData.results[0].url);
                } catch(e) {
                    console.log('Bad image.');
                    console.log(response);
                }
            },
            'jsonp'
        );
    } else {
        loadImage(src);
    }
}

function loadImage(src) {
    var specimg = $('<img class="specimg">').load(
        function(event) {
            sizeMap();
        });
                            
    $('.image').empty();
    $('.image').append(specimg);
    $('.specimg').attr('src',src);
}

function getURLParameter(name) {
    return decodeURI((RegExp(name + '=' + '(.+?)(&|$)')
    .exec(location.search)||[,null])[1]);
}
function getRandom() {
    $.getJSON(
        'http://mol.cartodb.com/api/v1/sql',
        {
            q: 'SELECT binomial ' +
               'FROM modis_prefs_join m ' +
               'JOIN ee_assets ee ON m.binomial = ee.scientificname ' +
               'LIMIT 1 OFFSET 33834*RANDOM()' 
               //33834 is the number of species we have to choose from
        },
        function (result) {
            //$('.search').val(getEE_ID(result.rows[0].binomial));
            $('.search .typeahead').val(result.rows[0].binomial);
            getEE_ID(result.rows[0].binomial);
        }
    );
}
function init() {
        //Set up autocomplete
        var species = new Bloodhound({
                datumTokenizer: function (d) {
                    return Bloodhound.tokenizers.whitespace(d.value);
                },
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 100,
                remote: {
                    url: 'http://mol.cartodb.com/api/v1/sql?q=' +
                    'SELECT n, v FROM ac ' +
                    'LEFT JOIN elevandhabitat e ' +
                    'ON ac.n = e.scientific ' + 
                    'LEFT JOIN modis_prefs_join m ' +
                    'ON ac.n = m.binomial ' + 
                    'WHERE ' +
                    '(m.modisprefs is not null OR ' + 
                    'e.habitatprefs is not null) ' +
                    "AND (n || ' ' || v) ~* '\\m%QUERY' LIMIT 300",
                    filter: function (response) {
                        return response.rows; 
                    }
                }
            });
        species.initialize();
        
        $('.search .typeahead').typeahead({
            minLength: 1,
            hint: true,
            highlight: true,
            items: 'all',
            scrollHeight: 300
        },{
            displayKey: 'n',
            source: species.ttAdapter(),
            templates: {
                empty: [
                  '<div class="empty-message">',
                    'No species found. ',
                  '</div>'
                ].join('\n'),
                suggestion: Handlebars.compile(
                    '<div class="species">'+
                        '<div class="n">{{n}}</div>'+
                        '<div class="v">{{v}}</div>'+
                    '</div>')
            }
        }).on(
            'typeahead:selected',
            function(evt,item) {
                getEE_ID(item.n);
            }
        );
      
      
      
      $('.habitats [class*=class_]').click(
          function() {
              if($(this).hasClass('selected')) {
                  $(this).removeClass('selected');
              } else {
                  $(this).addClass('selected');
              }
              $('.rerun').addClass('stale').addClass('pulse');
          }
      );

      
      $('.elev .range').slider({
          range: true,
          min: -500,
          max: 8000,
          tooltip: 'hide',
          handle: 'square',
          value: [-500, 8000],
          step: 100
       }).on(
          'slide',
          function(event) {
              var min = (event.value[0] >=0 ) ? event.value[0] : 0,
                  max = (event.value[1] >=0 ) ? event.value[1] : 0;
                $('.elev .values').html('{0}m to {1}m'.format(min, max));
                $('.rerun').addClass('stale').addClass('pulse');
              }
          
      );
      $('.forest .range').slider(
          {
              range: true,
              min: 0,
              max: 100,
              tooltip: 'hide',
              handle: 'square',
              value: [0, 100],
              step: 5 
           }
      ).on('slide', function(event) {
                $('.forest .values').html(
                    event.value[0]+ 
                    '%&nbsp;to&nbsp;' +
                    event.value[1] + '%');
                $('.rerun').addClass('stale').addClass('pulse');
              }
          
      );
      
      //init bootstrap switches
      $('.switch').bootstrapSwitch();
      $('.switch').show();
      
      $('.rerun').click(
          function() {
              
              speciesPrefs.rows[0].modis_habitats = $.map(
                  $('.habitats .selected'),
                  function(elem,index) {
                    return parseInt($(elem)
                        .attr("class")
                        .replace("class_","")
                        .replace("list-group-item","")
                        .replace("selected",""));
                  }
              ).join(',');
              try{speciesPrefs.rows[0].mine = $('.elev .range').data().slider.value[0];}
              catch(e) {speciesPrefs.rows[0].mine =-500;}
              try{speciesPrefs.rows[0].maxe = $('.elev .range').data().slider.value[1];}
              catch(e) {speciesPrefs.rows[0].maxe =8000;}
              try{speciesPrefs.rows[0].minf = $('.forest .range').data().slider.value[0];}
              catch(e) {speciesPrefs.rows[0].minf = 0;}
              try{speciesPrefs.rows[0].maxf = $('.forest .range').data().slider.value[1];}
              catch(e) {speciesPrefs.rows[0].maxf =100;}
              callBackend(speciesPrefs, false);
              $(this).removeClass('active');
          }
      );
      $('.random').click(
          function() {
              getRandom();
              $(this).removeClass('active');
          }
      );
     
    if(getURLParameter("name")!='null') {
        getEE_ID(getURLParameter("name"));
    } else {
        getRandom();
    }
}
function getEE_ID(name) {
    var sql = '' + 
         'SELECT *,' +
             "CASE "+
                "WHEN string_to_array('1,2,3,4,5',',') && " +
                    "string_to_array(modis_habitats,',') AND NOT (" +
                    "string_to_array('6,7,8,9,10,11,12,13,14,15,16,17,0',',') " +
                    "&& string_to_array(modis_habitats,','))" +
                "THEN 50 " +
                "WHEN (string_to_array('1,2,3,4,5',',') && " +
                    "string_to_array(modis_habitats,',')) AND (" +
                    "string_to_array('6,7,8,9,10,11,12,13,14,15,16,17,0',',') " +
                    "&& string_to_array(modis_habitats,',')) " +
                "THEN 0 " +
                "ELSE 0 " +
             "END as minf, " +
             "CASE " +
                "WHEN string_to_array('1,2,3,4,5',',') && " +
                    "string_to_array(modis_habitats,',') AND NOT (" +
                    "string_to_array('6,7,8,9,10,11,12,13,14,15,16,17,0',',') " +
                    "&& string_to_array(modis_habitats,',')) " +
                "THEN 100 " +
                "WHEN string_to_array('1,2,3,4,5',',') && " +
                    "string_to_array(modis_habitats,',') AND " +
                    "string_to_array('6,7,8,9,10,11,12,13,14,15,16,17,0',',') " +
                    "&& string_to_array(modis_habitats,',') " +
                "THEN 100 " +
                "ELSE 50 " +
             "END as maxf " +
         'FROM (SELECT DISTINCT ' +
                'l.scientificname as scientificname, ' +
                'CASE WHEN e.habitatprefs is null THEN ' +
                    'm.modisprefs '+
                'ELSE ' +
                  ' e.habitatprefs end as modis_habitats, ' +
                "CASE WHEN " +
                    "e.finalmin is null OR e.finalmin = 'DD' OR " + 
                    "e.finalmin = '-500' "+
                "THEN '-1000' ELSE e.finalmin END as mine, " +
                "CASE WHEN e.finalmax is null OR e.finalmax = 'DD' THEN '10000' else e.finalmax end as maxe, " +
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
            'LEFT JOIN ac n ON ' +
                'ee.scientificname = n.n ' +
            'LEFT JOIN elevandhabitat e ON ' +
                'ee.scientificname = e.scientific ' +
            'LEFT JOIN modis_prefs_join m' +
            ' ON ee.scientificname = m.binomial ' +
            'LEFT JOIN  eol ON ' +
            ' ee.scientificname = eol.scientificname AND eol.good = true ' +
            "where (m.modisprefs is not null OR e.habitatprefs is not null) AND (n.n~*'\\m{TERM}' OR n.v~*'\\m{TERM}') " +
                 " and ee.dataset_id ILIKE'%iucn%' " +
                 " and ee.ee_id is not null  " + 
                 " and l.type='range' and l.provider='iucn'" +
            ' LIMIT 1) m',
         term = name,
         source = (getURLParameter("source") != "null") ? 
            getURLParameter("source") : 'iucn',
         params = {q : sql.replace(/{TERM}/g,term).replace(/{SOURCE}/g,source)};
         
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
function callBackend(response, zoom) {
    var bounds, habitats;
    latest++; 
    
    $('.rerun .glyphicon').addClass('refreshing');
    $('.rerun').addClass('stale');
    
    scientificname = response.rows[0].scientificname;
    
    map.overlayMapTypes.clear();
    $('.metric').hide();
    sizeMap();
    
     
    speciesPrefs = response;
    
    //somethings broken
    if (response.total_rows == 0) {
        $('.rerun').removeClass('stale');
        $('.rerun .glyphicon').removeClass('refreshing');
        return;
    } 
    
    bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(response.rows[0].miny, response.rows[0].minx),
        new google.maps.LatLng(response.rows[0].maxy, response.rows[0].maxx)
    );
    
    if(zoom) {
        map.fitBounds(bounds);
        $('.image').empty();
        getImage(response.rows[0].eolmediaurl);
    }
    habitats = response.rows[0].modis_habitats.split(',');
    elev = [
        Math.floor(parseInt(response.rows[0].mine)/100)*100, 
        Math.ceil(response.rows[0].maxe/100)*100];
    elev[0] = (elev[0] == 0) ? -500 : elev[0];
    minf = response.rows[0].minf;
    maxf = response.rows[0].maxf;
    ee_id = response.rows[0].ee_id;
    scientificname = response.rows[0].scientificname;
    commonnames = ' (' + response.rows[0].names + ')';
    
    mod_params = {
        habitats : response.rows[0].modis_habitats,
        elevation : elev.join(','),
        ee_id : ee_id,
        mod_ver: 5.1, //$('.mod_ver').val(),
        minx: response.rows[0].minx,
        miny: response.rows[0].miny,
        maxx: response.rows[0].maxx,
        maxy: response.rows[0].maxy,
        minf: response.rows[0].minf,
        maxf: response.rows[0].maxf,
        sciname: response.rows[0].scientificname,
        call_ver: latest,
        use_f: $('.forest .switch').bootstrapSwitch('state'),
        use_e: $('.elev .switch').bootstrapSwitch('state'),
        use_h: $('.habitat .switch').bootstrapSwitch('state')
    };

    
    
    //use a Handlebars template here!
    
    $('.sciname').html(response.rows[0].scientificname);
    $('.common').html(response.rows[0].names.replace(/,.*/,''));
    if(response.rows[0]._class!=null) {        
        $('._class').html('Class: ' + response.rows[0]._class);
    } 
    
    $('.family').html('Family: ' + response.rows[0].family);
    $('._order').html('Order: ' + response.rows[0]._order);
    
    try{
        $('.forest .range').slider("setValue",[response.rows[0].minf,response.rows[0].maxf]);
        $('.forest .values').html(
            minf+ '%&nbsp;to&nbsp;' +maxf + '%');
    } catch(e) {
        $('.forest .range').slider("setValue",[0,100]);
        $('.elev .values').html('all');
    }
    
    
    
    if(elev[0] != '-1000' && elev[1] != '10000') {
        $('.elev .range').slider("setValue",[elev[0],elev[1]]);
        
        $('.elev .values').html(
            ((elev[0]>0) ? elev[0] : 0) + 'm&nbsp;to&nbsp;' + elev[1] + 'm');
    } else {
        $('.elev .range').slider("setValue",[-500,8000]);
        $('.elev .values').html('any');
        
    }
    
    $('.habitats [class*=class_]').removeClass('selected');
   
    $.each(
        habitats,
        function(i) {
            var h;
            if(parseInt(habitats[i])>0&&parseInt(habitats[i])<6) {
                h=1;
            } else {
                h=parseInt(habitats[i]);
            }
            $('.habitats .class_'+h).addClass('selected');
        }
    );
    $('.info').show('fade');
    
   
    $.getJSON(
        host+'refine', 
        mod_params, 
        function(response) {
            refineHandler(response);
        },
        'jsonp'
    ).error(
        function() {
            $.getJSON(
                host+'refine',
                mod_params,
                function(response) {
                    refineHandler(response);
                },
        'jsonp'
            ).error(
                function() {
                    $.getJSON(
                        host+'refine',
                        mod_params,
                        function(response) {
                            refineHandler(response);
                        },
                'jsonp'
                    ).error(
                        function(response) {
                            $('.rerun .glyphicon').removeClass('refreshing');
                            $('.rerun').removeClass('stale').removeClass('pulse');
                            $('#errModal .err').text(
                                JSON.stringify(response)
                            );
                            $('#errModal').modal();
                        }
                    );
                }
            );
        }
    );
}

function refineHandler(response) {
     $('.rerun .glyphicon').removeClass('refreshing');
     $('.rerun').removeClass('stale').removeClass('pulse');;

    mapHandler(response.maps);
    metricsHandler(response.metrics);
}

// Feeds a metric object into a Handlerbars template and adds the html to the DOM
function metricsHandler(metrics) {
    $('.metrics_container').empty();
    $.each(
        metrics,
        function(i, metric) {
           
           if (metric.name != null && metric.value != null) {
               metric.value = addCommas(metric.value); 
               $('.metrics_container').append($(
                   Handlebars.compile($('#metric').html())(metric).trim())[0]);
           }
        }
    );
    sizeMap();
}

function mapHandler(map_layers) {

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
            
    map.overlayMapTypes.clear();
    map.overlayMapTypes.push(cdb_maptype);
    $.each(
        map_layers,
        function(key, val ) {
            if(val) {
                if(val.tile_url) {
                    maptype = new google.maps.ImageMapType({
                        getTileUrl: function(coord, zoom) {
                            return val.tile_url
                                .replace(/{X}/g, coord.x)
                                .replace(/{Y}/g, coord.y)
                                .replace(/{Z}/g, zoom);
                        },
                        tileSize: new google.maps.Size(256, 256)
                    });
                    if (val.opacity) {
                        maptype.setOpacity( val.opacity);
                    }
                    map.overlayMapTypes.push(maptype);
                }
        }
        }
    );
    
    
    
}
function sizeMap() {
    $('.map').height($('.left').height()-$('.right .top').height());
    google.maps.event.trigger(map, "resize");
}
function addCommas(val){
    if (val == null) {
        return '';
    }
    if (val < 0) {
        return val.toString();
    }
    while (/(\d+)(\d{3})/.test(val.toString())){
      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
    }
    return val;
  }
  
$(function(){
    $('a, button').click(function() {
        $(this).toggleClass('active');
    });
});
/**
 * https://gist.github.com/1049426
 * 
 * Usage: 
 * 
 *   "{0} is a {1}".format("Tim", "programmer");
 * 
 */
String.prototype.format = function(i, safe, arg) {
  function format() {
      var str = this, 
          len = arguments.length+1;
      
      for (i=0; i < len; arg = arguments[i++]) {
          safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
          str = str.replace(RegExp('\\{'+(i-1)+'\\}', 'g'), safe);
      }
      return str;
  }
  format.native = String.prototype.format;
  return format;
}();

function getTemplate(name, data) {
    return $.get('/templates/'+name+'.hbs').then(function(src) {
       return Handlebars.compile(src)(data);
    });
}
