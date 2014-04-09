var latest = 0, 
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
    $('.image').empty();
    $.getJSON(
        'https://ajax.googleapis.com/ajax/services/search/images?' +
        'v=1.0&q={0}&callback=?'.format(name),
        function(response) {
                if(response.responseData != null) {
                    loadImage(response.responseData.results[i].url, name, i);
                } else {
                    getImage(name,(i+1));
                }
        },
        'jsonp'
    );
}

function loadImage(src,name, i) {
    var specimg = $('<img class="specimg" src="{0}">'.format(src))
        .load(
            function(event) {
                //sizeMap();
                $('.image').empty();
                $('.image').append(this);
               
            }).error(
                function() {
                    var n = i+1;
                    getImage(name, n);
                }
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
                    url: 'http://d3dvrpov25vfw0.cloudfront.net/api/v1/sql?q=' +
                    'SELECT n, v FROM ac ' +
                    'JOIN distinctness d ' +
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
        //messy
        $('.typeahead').css('padding-left','1em');
      
      
      
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

      $('.selectpicker').selectpicker({width:'100%'});
      $('.search button').addClass('top_button');
      
      
      $('.random').click(
          function() {
              getRandom();
              $(this).removeClass('active');
          }
      );
    name = unescape(location.pathname.split('/').pop());
    name = name.replace(/_/g,' ');
    
    if(name.split(' ').length>1) {
        updateSpecies(name);
    } else {
        getRandom();
    }
    $("[rel='tooltip']").tooltip();
           
}
function getName(name) {
    $.getJSON(
        'http://d3dvrpov25vfw0.cloudfront.net/api/v2/sql', 
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
            $('.description').html(shorten(response.content,400));
            $('.description .expand').click(
                function(){
                    $('.description').html(response.content);
                }
            );
        }
    );
}
function shorten(text, maxLength) {
    var ret = text;
    if (ret.length > maxLength) {
        ret = ret.substr(0,maxLength-3);
        ret = ret.substr(0, ret.lastIndexOf('.')) + 
            "<a class='expand' rel='tooltip' title='Click for more'>...</a>";
    }
    return ret;
}
function updateSpecies(name) {
    history.pushState('data','', '/info/birds/{0}'.format(name.replace(/ /g,'_')));
    getTaxon(name);
    getImage(name, 0);
    getWiki(name);
    mapSpecies(name);
}
function getTaxon(name) {
    var sql = 'SELECT scientificname, initcap("class") as _class, '+
            'common_names_eng as names, initcap(_order) as _order, ' +
            'initcap(family) AS family, ' +
            'round(cast(edr_q as numeric),2) as edr_q, ' +
            'round(cast(ed_q as numeric),2) as ed_q, ' +
            'round(cast(edge_q as numeric),2) as edge_q, ' +
            'round((cast(area as numeric)/1000000)/10000,2) as area, ' +
            'round(cast(area_q as numeric),2) as area_q, ' +
            'round(cast(ed_95percentile as numeric),2) as ed_95, ' +
            'round(cast(ed_05percentile as numeric),2) as ed_05, ' +
            'round(cast(edd_95percentile as numeric),2) as edr_95, ' +
            'round(cast(edd_05percentile as numeric),2) as edr_05, ' +
            'round(cast(edd_my_10_4km__2 as numeric),2) as edr, ' +
            'round(cast(edge as numeric),2) as edge, ' +
            'round(cast(ed_median as numeric),2) as ed ' +
            'FROM taxonomy t JOIN distinctness d ON '+
               "d.species_scientific = t.scientificname  WHERE " +
               " t.scientificname ILIKE '{0}'";
    $.getJSON(
        'http://d3dvrpov25vfw0.cloudfront.net/api/v2/sql',
        {
            q: sql.format(name)
        },
        function(response) {
            var row = response.rows[0],
                charts = [
                {
                    'id':'ed',
                    'name':'Evolutionary Distinctness: {0} MY ({1}-{2})'
                        .format(row.ed,row.ed_05, row.ed_95),
                    'value':row.ed_q*100,
                    'scale': [0.77,4.23,6.19,9.14,72.77]
                    
                },{
                    'id': 'edr',
                    'name':'Evolutionary Distinctness Rarity: {0} MY 10⁴ km² ({1}-{2})'
                        .format(row.edr, row.edr_05, row.edr_95),
                    'value':row.edr_q*100,
                    'scale': [0,0.02,0.07,0.26,9.95]
                    
                },{
                    'id':'edge',
                    'name':'EDGE Score: {0}'.format(row.edge),
                    'value':row.edge_q*100,
                    'scale': [0.58,1.76,2.13,2.69,6.83]
                },{
                    'id':'area',
                    'name':'Expert range area: {0} 10⁴ km²'.format(addCommas(row.area)),
                    'value': row.area_q*100 ,
                    'scale': [0,4.54,31.62,164.35,'23,085.92']
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
            
            
            $.each(
                charts,
                function (i, chart) {
                    if($('.chart.{0}'.format(chart.id)).length>0) {
                        $('.chart.{0} .title'.format(chart.id)).html(
                            chart.name
                        );
                        
                        $('.chart.{0} .bar'.format(chart.id))
                            .animate(
                                {width:'{0}%'.format(chart.value)},
                                1500
                            );
                    } else {
                        $('.chart_{0}'.format((i&1) ? 'right' : 'left')).append($(
                               Handlebars.compile(
                                   $('#scale_chart').html())(chart)
                                       .trim())[0]);
                    }
                }
            );
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
    val = Math.round(val*100)/100
    
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
