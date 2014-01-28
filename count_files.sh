#!/bin/bash

echo -e "path\tfiles\tchanges"

for i in `find $1 -type d`;
do 
   count=`find $i -name "*.java" -or -name "*.scala" -type f|wc -l`
   if [ $count -gt 0 ]
     then     
       changes=`(cd $i; git diff $2 --name-only -- $i)|grep -e java -e scala|wc -l`
       echo -e $i"\t"$count"\t"$changes
   fi;
done|cut -b 2-
