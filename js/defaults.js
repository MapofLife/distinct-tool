var defaults = {
     map_options : {
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
    }
};
