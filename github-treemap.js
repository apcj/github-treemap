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
    d3.select('.filters').text(filters ? "(only files with extensions " + filters + ")" : "(all files)");

    var margin = {top: 36, right: 0, bottom: 28, left: 0};

    var greenToRed = d3.scale.linear().domain([0, 1]).range([120, 0]);
    var saturation = d3.scale.linear().domain([0, 1]).range([.5, 1]);
    var brightness = d3.scale.linear().domain([0, 1]).range([.9, .5]);

    function changeRatio( file )
    {
        var size = Math.max(file.startSize, file.endSize);
        var number = size > 0 && file.changes > 0 ? file.changes / size : 0;
        if (isNaN(number)) console.log(file);
        return number;
    }

    function fillColor( file, changeRatios ) {
        var changes = changeRatio( file );
        if ( changes === 0 )
        {
            return null;
        }
        var ratio = changeRatios.indexOf(changes) / (changeRatios.length - 1);
        return d3.hsl(greenToRed(ratio), saturation(ratio), brightness(ratio)).toString();
    }

    function borderColor( file ) {
        var test = file.file.filename.indexOf("test") !== -1;
        return test ? "#77A" : "#AAA"
    }

    var treemap = d3.layout.treemap()
        .sticky(true)
        .padding(1)
        .value(function(file) { return Math.max(file.startSize, file.endSize); });

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
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var segments = file.filename.split("/");
            var node = root;
            for (var d = 0; d < segments.length; d++) {
                var segment = segments[d];
                if (!node.children) {
                    node.children = [];
                }
                var child = node.children.filter(function(segment) { return function (child) { return child.name === segment; }}(segment))[0];
                if (!child) {
                    node.children.push(child = { name: segment } );
                }
                node = child;
            }
            node[key] = file.size;
            node.file = file;
        }
    }

    var repoUri = "https://api.github.com/repos/" + owner + "/" + repo;

    function gitData(uri, transform, callback) {
        var cacheIndex = {};
        var cacheIndexKey = "github-treemap.cache-index";
        var cacheIndexString = window.localStorage.getItem(cacheIndexKey);
        if (cacheIndexString !== null) {
            cacheIndex = JSON.parse(cacheIndexString);
        }
        function storeIndex() {
            window.localStorage.setItem(cacheIndexKey, JSON.stringify(cacheIndex));
        }
        var cachedResult = window.localStorage.getItem(uri);
        if (cachedResult) {
            cacheIndex[uri].lastUsed = new Date().getTime();
            storeIndex();
            callback(null, JSON.parse(cachedResult));
        } else {
            d3.json(uri, function(error, data) {
                var simplified = transform(data);
                function storeInCache() {
                    window.localStorage.setItem(uri, JSON.stringify(simplified));
                    cacheIndex[uri] = { uri: uri, lastUsed: new Date().getTime() };
                    storeIndex();
                }
                function handleQuotaExceeded(e) {
                    if (e.name === "QuotaExceededError") {
                        if(d3.keys(cacheIndex).length > 0) {
                            var evictable = d3.values(cacheIndex).sort(function(a, b) { return a.lastUsed - b.lastUsed; })[0];
                            console.log("evicting", evictable);
                            delete cacheIndex[evictable.uri];
                            window.localStorage.removeItem(evictable.uri);
                            storeIndex();
                            try {
                                storeInCache();
                            } catch (e) {
                                handleQuotaExceeded(e);
                            }
                        }
                    } else {
                        throw e;
                    }
                }
                try {
                    storeInCache();
                } catch (e) {
                    handleQuotaExceeded(e);
                }
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

    gitData(repoUri + "/commits/" + startCommit, function(data) { return data; }, function(error, data) {
        var startTree = data.commit.tree.sha;
        gitData(repoUri + "/git/trees/" + startTree + "?recursive=1", extractFileListFromTree, function(error, originalFiles) {
            originalFiles = originalFiles.filter(interesting);

            var root = {};
            updateTree(root, originalFiles, "startSize");

            gitData(repoUri + "/commits/" + endCommit, function(data) { return data; }, function(error, data) {
                var endTree = data.commit.tree.sha;
                gitData(repoUri + "/git/trees/" + endTree + "?recursive=1", extractFileListFromTree, function(error, endFiles) {
                    endFiles = endFiles.filter(interesting);

                    updateTree(root, endFiles, "endSize");

                    gitData(repoUri + "/compare/" + startCommit + "..." + endCommit, extractFileListFromDiff, function(error, changedFiles) {
                        changedFiles = changedFiles.filter(interesting);

                        var changedFileCount = changedFiles.length;
                        updateTree(root, changedFiles, "changes");

                        function filesInTree(node) {
                            if ( node.children ) {
                                return node.children.reduce(function(a, b) { return a.concat(filesInTree(b));}, []);
                            }
                            return [node];
                        }

                        var allFiles = filesInTree( root );
                        var changeRatios = allFiles.map( changeRatio ).filter(function(d) { return d > 0; }).sort();

                        d3.select( ".count.total.files" ).text( allFiles.length );
                        d3.select( ".count.changed.files" ).text( changedFileCount );
                        d3.select( ".percentage.changed.files" ).text(((changedFileCount / allFiles.length) * 100).toFixed());

                        var node = div.datum(root).selectAll(".node")
                            .data(treemap.nodes);

                        resize();

                        node.enter().append("div")
                            .attr("class", "node");

                        node.exit().remove();

                        node.call(position)
                            .style("background", function(d) { return d.children ? null : fillColor(d, changeRatios); })
                            .style("border", function(d) { return d.children ? null : "1px solid " + borderColor(d); })
                            .text(function(d) { return d.children ? null : d.name; })
                            .on("mouseover", function(d) {
                                var text = d.file ? d.file.filename.replace(/\//g, " / ") : null;
                                d3.select("#filename").text( text);
                            });
                    });
                });
            });
        });
    });
}

window.onhashchange = renderPage;
renderPage();
