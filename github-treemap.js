var margin = {top: 36, right: 0, bottom: 28, left: 0};

var greenToRed = d3.scale.linear().domain([0, 1]).range([120, 0]);
var blueToRed = d3.scale.linear().domain([0, 1]).range([240, 360]);
var saturation = d3.scale.linear().domain([0, 1]).range([.5, 1]);
var brightness = d3.scale.linear().domain([0, 1]).range([.9, .5]);

function color(file) {
    var ratio = (file.changes || 0) / file.size;
    if (ratio > 1) console.log(ratio, file);
    ratio = Math.min(1, ratio);
    var test = file.file.filename.indexOf("test") !== -1;
    return d3.hsl(test ? blueToRed(ratio) : greenToRed(ratio), saturation(ratio), brightness(ratio)).toString();
}

var treemap = d3.layout.treemap()
    .sticky(true)
    .padding(1)
    .value(function(d) { return d.size; });

var div = d3.select("#canvas")
    .style("left", margin.left + "px")
    .style("top", margin.top + "px")
    .style("right", margin.right + "px")
    .style("bottom", margin.bottom + "px");

function position() {
    this.style("left", function(d) { return d.x + "px"; })
        .style("top", function(d) { return d.y + "px"; })
        .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
        .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
}

var width, height;

function measure() {
    console.log("Resize");

    width = window.innerWidth - margin.left - margin.right;
    height = window.innerHeight - margin.top - margin.bottom;

    treemap
        .size([width, height]);
}

function resize() {
    measure();

    var node = div.selectAll(".node")
        .data(treemap.nodes)
        .call(position);

    console.log(node);
}

measure();
window.onresize = resize;

function updateTree(root, files, key) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var extension = (/\.([^\.]+)$/.exec(file.filename) || [])[1];

        var excluded = ["js", "css", "graffle", "in", "txt", "less", "svg"];

        if (excluded.indexOf(extension) !== -1) {
            continue;
        }
        var segments = file.filename.split("/");
        var node = root;
        for (var d = 0; d < segments.length; d++) {
            var segment = segments[d];
            if (!node.children) {
                node.children = [];
            }
            var child = node.children.filter(function (child) { return child.name === segment; })[0];
            if (!child) {
                node.children.push(child = { name: segment } );
            }
            node = child;
        }
        node[key] = file.changes;
        node.file = file;
    }
}

var hashParams = function() {
    var list = window.location.hash.substr(1).split("&");
    var map = {};
    for (var i = 0; i < list.length; i++) {
        var tokens = list[i].split("=");
        map[tokens[0]] = tokens[1];
    }
    return map;
}();

var initialCommit = hashParams["initial"];
var startCommit = hashParams["start"];
var endCommit = hashParams["end"];
var repo = "apcj/neo4j";
var compareUri = "https://api.github.com/repos/" + repo + "/compare/";

// 9c4f3c010b03070098c2102d46d347bac809f4e5

function getCachedJson(uri, callback) {
    var cached = window.localStorage.getItem(uri);
    console.log(uri);
    if (cached) {
        callback(null, JSON.parse(cached));
    } else {
        d3.json(uri, function(error, data) {
            var simplified = data.files.map(function(file) { return { filename: file.filename, changes: file.changes }; });
            window.localStorage.setItem(uri, JSON.stringify(simplified));
            callback(error, simplified);
        });
    }
}
getCachedJson(compareUri + initialCommit + "..." + endCommit, function(error, files) {
    var root = {};

    updateTree(root, files, "size");

    getCachedJson(compareUri + startCommit + "..." + endCommit, function(error, files) {

        updateTree(root, files, "changes");

        console.log(root);

        var node = div.datum(root).selectAll(".node")
            .data(treemap.nodes);

        resize();

        node.enter().append("div")
            .attr("class", "node");

        node.call(position)
            .style("background", function(d) { return d.children ? null : color(d); })
            .style("border", function(d) { return d.children ? null : "1px solid gray"; })
            .text(function(d) { return d.children ? null : d.name; })
            .on("mouseover", function(d) {
                var text = d.file ? d.file.filename.replace(/\//g, " / ") : null;
                d3.select("#filename").text( text);
            });
    });
});

