SVGPATH=$1
FILENAME=${SVGPATH%.*}

if [ ! -f $SVGPATH ]; then
    echo "File not '$SVGPATH' found!"
    exit 0
fi

ALL_SIZES="16 32 48 64"

for SIZE in $ALL_SIZES
do
rsvg-convert --no-keep-image-data -f png -w $SIZE -h $SIZE -o $FILENAME$SIZE.png $SVGPATH
done

cp ${FILENAME}16.png $FILENAME-Template.png
cp ${FILENAME}32.png $FILENAME-Template@2x.png
cp ${FILENAME}64.png $FILENAME-Template@3x.png
cp ${FILENAME}64.png $FILENAME.png

for SIZE in $ALL_SIZES
do
rm $FILENAME$SIZE.png;
done
