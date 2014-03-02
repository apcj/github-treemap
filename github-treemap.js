function renderPage() {
    var hashParams = /#\/repos\/([^/]+)\/([^/]+)\/compare\/([^?]+)\.\.\.([^?]+)(\?filter=(.+))?/.exec(window.location.hash);
    var owner = hashParams[1];
    var repo = hashParams[2];
    var startCommit = hashParams[3];
    var endCommit = hashParams[4];
    var filters = hashParams[6];

    d3.select('.owner').text(owner);
    d3.select('.repo').text(repo);
    d3.select('.start.commit').text(startCommit);
    d3.select('.end.commit').text(endCommit);

    var margin = {top: 36, right: 0, bottom: 28, left: 0};

    var greenToRed = d3.scale.linear().domain([0, 1]).range([120, 0]);
    var saturation = d3.scale.linear().domain([0, 1]).range([.5, 1]);
    var brightness = d3.scale.linear().domain([0, 1]).range([.9, .5]);

    function changeRatio( file )
    {
        var number = file.size > 0 && file.changes > 0 ? file.changes / file.size : 0;
        if (isNaN(number)) console.log(file);
        return number;
    }

    function fillColor( file, maxChangeRatio ) {
        var ratio = changeRatio(file) / maxChangeRatio;
        if ( ratio == 0 )
        {
            return null;
        }
        ratio = Math.min(1, ratio);
        return d3.hsl(greenToRed(ratio), saturation(ratio), brightness(ratio)).toString();
    }

    function borderColor( file ) {
        var test = file.file.filename.indexOf("test") !== -1;
        return test ? "#77A" : "#AAA"
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
    }

    measure();
    window.onresize = resize;

    function interesting(file) {
        if (filters) {
            var extension = (/\.([^\.]+)$/.exec(file.filename) || [])[1];
            var included = filters.split(",");
            return included.indexOf(extension) !== -1
        } else {
            return true;
        }
    }

    function updateTree(root, files, key) {
        var totalSize = 0;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
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
            totalSize += file.size;
            node[key] = file.size;
            node.file = file;
        }
        return totalSize;
    }

    var repoUri = "https://api.github.com/repos/" + owner + "/" + repo;

    function getCachedJson(uri, transform, callback) {
        var cached = window.localStorage.getItem(uri);
        if (cached) {
            callback(null, JSON.parse(cached));
        } else {
            d3.json(uri, function(error, data) {
                var simplified = transform(data);
                window.localStorage.setItem(uri, JSON.stringify(simplified));
                callback(error, simplified);
            });
        }
    }

    function extractFileListFromTree(treeData) {
        return treeData.tree.map(function(file) { return { filename: file.path, size: file.size }; });
    }

    function extractFileListFromDiff(diffData) {
        return diffData.files.map(function(file) { return { filename: file.filename, size: file.changes }; });
    }

    getCachedJson(repoUri + "/commits/" + startCommit, function(data) { return data; }, function(error, data) {
        var startTree = data.commit.tree.sha;
        getCachedJson(repoUri + "/git/trees/" + startTree + "?recursive=1", extractFileListFromTree, function(error, files) {
            files = files.filter(interesting);

            var root = {};
            var totalFiles = files.length;
            updateTree(root, files, "size");

            getCachedJson(repoUri + "/compare/" + startCommit + "..." + endCommit, extractFileListFromDiff, function(error, files) {
                files = files.filter(interesting);

                var changedFiles = files.length;
                updateTree(root, files, "changes");

                function filesInTree(node) {
                    if ( node.children ) {
                        return node.children.reduce(function(a, b) { return a.concat(filesInTree(b));}, []);
                    }
                    return node;
                }
                var maxChangeRatio = filesInTree(root).map( changeRatio ).reduce( function(a, b) { return Math.max(a, b); }, 0 );

                d3.select( ".count.total.files" ).text( totalFiles );
                d3.select( ".count.changed.files" ).text( changedFiles );
                d3.select( ".percentage.changed.files" ).text(((changedFiles / totalFiles) * 100).toFixed());

                var node = div.datum(root).selectAll(".node")
                    .data(treemap.nodes);

                resize();

                node.enter().append("div")
                    .attr("class", "node");

                node.call(position)
                    .style("background", function(d) { return d.children ? null : fillColor(d, maxChangeRatio); })
                    .style("border", function(d) { return d.children ? null : "1px solid " + borderColor(d); })
                    .text(function(d) { return d.children ? null : d.name; })
                    .on("mouseover", function(d) {
                        var text = d.file ? d.file.filename.replace(/\//g, " / ") : null;
                        d3.select("#filename").text( text);
                    });
            });
        });
    });
}

window.onhashchange = renderPage;
renderPage();
