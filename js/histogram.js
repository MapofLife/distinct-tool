function addHistogram(values) {

// A formatter for counts.
var formatCount = d3.format(",.0f");

var margin = {top: 35, right: 40, bottom: 50, left: 70},
    width = 500 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

var x = d3.scale.linear()
    .domain([0, 80])
    .range([0, width]);

// Generate a histogram 
var data = d3.layout.histogram()
    .bins(x.ticks(80)) //number of bins
    (values.map(function(val){return val[1]}));

var y = d3.scale.linear()
    .domain([0, d3.max(data, function(d) { return d.y; })])
    .range([height, 0]);
    

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient('left');

var svg = d3.select(".chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var bar = svg.selectAll(".bar")
    .data(data)
    .enter().append("g")
    .attr("class", "bar")
    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

bar.append("rect")
    .attr("x", 1)
    .attr("width", x(data[0].dx) - 1)
    .attr("height", function(d) { return height - y(d.y); });

/*bar.append("text")
    .attr("dy", ".75em")
    .attr("y", 6)
    .attr("x", x(data[0].dx) / 2)
    .attr("text-anchor", "middle")
    .text(function(d) { return formatCount(d.y); });*/

svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis)
    .append("text")
    .attr("x", width/2)
    .attr("y", 36)
    .style("text-anchor","middle")
    .text("Evolutionary Distinctness (MY)");

svg.append("g")         // Add the Y Axis
    .attr("class", "y axis")
    .call(yAxis)
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -46)
    .attr("x",-1*(height/2))
    //.attr("dy", ".71em")
    .style("text-anchor", "middle")
    .text("Number of species");
}
function selectBucket(val) {
    var bucket = Math.floor(val);
    d3.selectAll('.bar rect').style('fill','#8cbf44');
    $(d3.selectAll('.bar rect')[0][bucket]).css('fill','#D9903D');
}
