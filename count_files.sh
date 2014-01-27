#!/bin/bash

echo -e "path\tfiles\tchanges"

for i in `find $1 -type d`;
do 
   count=`find $i -name "*.java" -or -name "*.scala" -maxdepth 1 -type f|wc -l`
   if [ $count -gt 0 ]
     then     
       changes=`(cd $i; git diff HEAD~10..HEAD --name-only -- $i)|wc -l`
       echo -e $i"\t"$count"\t"$changes
   fi;
done|cut -b 2-
