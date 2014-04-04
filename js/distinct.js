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

function getImage(name,i) {

    $.getJSON(
        'https://ajax.googleapis.com/ajax/services/search/images?' +
        'v=1.0&q={0}&callback=?'.format(name),
        function(response) {
                loadImage(response.responseData.results[i].url, name, i);
        },
        'jsonp'
    );
}

function loadImage(src,name, t) {
    var specimg = $('<img class="specimg">').load(
        function(event) {
            sizeMap();
        }).error(
            function() {
                var t = i++;
                getImage(name, t);
            }
        );
                            
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
            q: 'SELECT n ' +
               'FROM ac  ' +
               'JOIN distinctness d ON ac.n = d.species_scientific ' +
               'LIMIT 1 OFFSET 9999*RANDOM()' 
               //33834 is the number of species we have to choose from
        },
        function (result) {
            //$('.search').val(getEE_ID(result.rows[0].binomial));
            $('.search .typeahead').val(result.rows[0].n);
            updateSpecies(result.rows[0].n);
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
                    'LEFT JOIN distinctness d ' +
                    'ON ac.n = d.species_scientific ' +
                    'WHERE ' +
                    "(n || ' ' || v) ~* '\\m%QUERY' LIMIT 300",
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
                updateSpecies(item.n);
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

      $.getJSON(
          'http://mol.cartodb.com/api/v2/sql',
          {'q' : 'SELECT species_scientific as n, ed_median as ed ' +
            'FROM distinctness ORDER BY ed_median asc'},
          function (response) {
              var histData = response.rows.map(
                  function(row) {
                      return [
                        [row.n,row.ed]
                      ];
                  });
                  /*bubData = response.rows.map(
                      function(row) {
                          return [
                            {"name":row.n,
                             "size": Math.round(parseFloat(row.ed)*100)}
                          ];
                      }
                  );*/
              //addBubbles({"name":"ED", "children":data});
              //addHistogram(histData);
              //addCharts(data);
          }
      );
    
      //init bootstrap switches
      $('.switch').bootstrapSwitch();
      $('.switch').show();
      
      $('.random').click(
          function() {
              getRandom();
              $(this).removeClass('active');
          }
      );
     
    if(getURLParameter("name")!='null') {
        getName(getURLParameter("name"));
    } else {
        getRandom();
    }
}
function getName(name) {
    $.getJSON(
        'http://mol.cartodb.com/api/v2/sql', 
        params, 
        callBackend
        ).error(
            function() {
                $('.working').hide();
            }
        );    
}
function getWiki(name) {
    $.getJSON(
        'http://api.map-of-life.appspot.com/wiki',
        {name:name, api_key:'allyourbase'},
        function(response) {
            $('.description').text(shorten(response.content,500));
        }
    );
}
function shorten(text, maxLength) {
    var ret = text;
    if (ret.length > maxLength) {
        ret = ret.substr(0,maxLength-3) + 
            "...";
    }
    return ret;
}
function updateSpecies(name) {
    getTaxon(name);
    getImage(name, 0);
    getWiki(name);
    mapSpecies(name);
}
function getTaxon(name) {
    var e_sql = "SELECT 'ed' as t, round(ed,2) as v, round(q,2) as q FROM "+
  "  (SELECT "+
      " cast(row as numeric)/cast(tot as numeric) as q, "+
       "cast(ed as numeric) as ed,  "+
      " n "+
     "FROM "+
       "(SELECT "+
          "row_number() over (order by ed_median asc nulls last)  as row,"+
          "(SELECT count(*) from distinctness)as tot,           species_scientific as n,"+
          "ed_median as ed "+
        "FROM distinctness order by ed asc) ed "+
     "where n = '{0}') edq "+
"UNION ALL "+
"SELECT 'edr' as t, round(edr,2) as v, round(q,2) as q FROM "+
    "(SELECT "+
       "cast(row as numeric)/cast(tot as numeric) as q, "+
       "cast(edr as numeric) as edr,  "+
       "n "+
     "FROM "+
       "(SELECT "+
         " row_number() over (order by edd_my_10_4km__2 asc nulls last)  as row,"+
         " (SELECT count(*) from distinctness)as tot,           species_scientific as n,"+
          "edd_my_10_4km__2 as edr"+
       " FROM distinctness order by edr asc) edr "+
     "where n = '{0}') edrq",
     sql = 'SELECT scientificname, initcap("class") as _class, '+
            'common_names_eng as names, initcap(_order) as _order, ' +
            'initcap(family) AS family, ' +
            'round(cast(ed_95percentile as numeric),2) as ed_95, ' +
            'round(cast(ed_05percentile as numeric),2) as ed_05, ' +
            'round(cast(edd_95percentile as numeric),2) as edr_95, ' +
            'round(cast(edd_05percentile as numeric),2) as edr_05, ' +
            'round(cast(edd_my_10_4km__2 as numeric),2) as edr, ' +
            'round(cast(edge as numeric),2) as edge, ' +
            'round(cast(ed_median as numeric),2) as ed, ed_rank_all, ' +
            "round((SELECT sum(CAST(ST_Area(geography(ST_Transform(the_geom_webmercator,4326)))/1000000 as numeric)) as area FROM get_tile('jetz','range','{0}', 'jetz_maps'))) as area " + 
            'FROM taxonomy t JOIN distinctness d ON '+
               "d.species_scientific = t.scientificname  WHERE " +
               " t.scientificname = '{0}'";
     $.getJSON(
        'http://mol.cartodb.com/api/v2/sql',
        {
            q: e_sql.format(name)
        },
        function(response) {
            var row = [0];
            $.each(
                response.rows,
                function(i,row) {
                    $('.chart.{0} .box .bar'.format(row.t)).width('{0}%'.format(row.q*100));
                }
            );
            
           
        }
    );
    $.getJSON(
        'http://mol.cartodb.com/api/v2/sql',
        {
            q: sql.format(name)
        },
        function(response) {
            var row = response.rows[0],
                metrics = [
                {
                    'name':'Evolutionary Distinctness',
                    'units':'MY ({0}-{1} MY)'
                        .format(row.ed_05, row.ed_95),
                    'value':row.ed
                },{
                    'name':'Distinctness Rarity',
                    'units': 'MY 10⁴ km² ({0}-{1} MY)'
                        .format(row.edr_05, row.edr_95),
                    'value':row.edr
                },{
                    'name':'EDGE Score',
                    'value':row.edge
                },{
                    'name':'Expert range area',
                    'value': addCommas(row.area),
                    'units': 'km²'
                }
            ];

            $('.sciname').html(response.rows[0].scientificname);
            $('.common').html(response.rows[0].names.replace(/,.*/,''));
            if(response.rows[0]._class!=null) {        
                $('._class').html('Class: {0}'.format(response.rows[0]._class));
            } 
            
            $('.family').html(
                'Family: {0}'.format(response.rows[0].family));
            $('._order').html(
                'Order:{0}'.format(response.rows[0]._order));
                
                
            
            $('.metrics').empty();
            $.each(
                metrics,
                function (i, metric) {
                    $('.metrics').append($(
                           Handlebars.compile(
                               $('#metric').html())(metric)
                                   .trim())[0]);
                }
            );
            selectBucket(response.rows[0].ed);
        }
    );
}
function mapSpecies(name) {

    var cdb_url = "http://d3dvrpov25vfw0.cloudfront.net/" +
            "tiles/demo/{Z}/{X}/{Y}.png?sql=" +
            "SELECT * FROM get_species_tile('{0}')",
            sql = "SELECT " +
                'ST_xmin(l.extent_4326) as minx, ' +
                'ST_ymin(l.extent_4326) as miny, ' +
                'ST_xmax(l.extent_4326) as maxx, ' +
                'ST_ymax(l.extent_4326) as maxy ' +
            " FROM (SELECT  " +
            "ST_Extent(ST_Transform(the_geom_webmercator,4326)) as extent_4326 FROM get_species_tile('{0}')) l";
        
        cdb_maptype  = new google.maps.ImageMapType({
                getTileUrl: function(coord, zoom) {
                    return cdb_url.format(name)
                        .replace(/{X}/g, coord.x)
                        .replace(/{Y}/g, coord.y)
                        .replace(/{Z}/g, zoom);
                },
                tileSize: new google.maps.Size(256, 256),
                opacity:0.6
            });
            
    map.overlayMapTypes.clear();
    map.overlayMapTypes.push(cdb_maptype); 
    $.getJSON(
        'http://d3dvrpov25vfw0.cloudfront.net/api/v2/sql',
        {q: sql.format(name)
        }, 
        function(response) {
            var  bounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(response.rows[0].miny, response.rows[0].minx),
                new google.maps.LatLng(response.rows[0].maxy, response.rows[0].maxx)
            );
           
            map.fitBounds(bounds);
            
            
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
