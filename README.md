#Code Changes Tree Map

Run `count_files.sh`, passing a directory and a commit range you want to analyse. For example:

    $ ./count_files.sh projects/neo4j HEAD~10..HEAD >data.tsv

Then start a web server and open `index.html` in your browser. Something like this:

    $ python -m SimpleHTTPServer 8888 &
    $ open http://localhost:8888/

A treemap recursively subdivides area into rectangles; the area of any node in the tree corresponds to its value. 
Treemap design invented by [Ben Shneiderman](http://www.cs.umd.edu/~ben/). 
Squarified algorithm by [Bruls, Huizing and van Wijk](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.36.6685). 

